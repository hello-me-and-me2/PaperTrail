import { userQueries_extra, orgFileQueries, alertQueries } from '../db';
import { aiAnalyzeEntity } from './aiAnalyzer';
import { sendCorruptionAlertEmail } from './emailService';
import { sendPushNotification } from './pushService';

const ALERT_THRESHOLD = 50; // score that triggers an alert
const MAX_ENTITIES_PER_RUN = 4; // AI calls per user per cycle (cost control)

// Parse a CSV/TSV line (simple, handles quotes)
function splitLine(line: string, sep: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === sep && !inQ) { cols.push(cur.trim().replace(/^"|"$/g, '')); cur = ''; }
    else cur += ch;
  }
  cols.push(cur.trim().replace(/^"|"$/g, ''));
  return cols;
}

interface Entity { name: string; type: 'recipient' | 'person' }

function extractEntities(content: string, fileType: string): Entity[] {
  const entities: Entity[] = [];
  const NAME_KEYS = ['vendor', 'supplier', 'payee', 'recipient', 'contractor', 'company', 'name', 'entity', 'organization'];
  const PERSON_KEYS = ['employee', 'contact', 'person', 'staff', 'full_name', 'first_name'];

  if (fileType === 'csv' || fileType === 'tsv') {
    const sep = fileType === 'tsv' ? '\t' : ',';
    const lines = content.split('\n').filter(Boolean);
    if (lines.length < 2) return entities;
    const headers = splitLine(lines[0], sep).map(h => h.toLowerCase());

    const vendorIdx = headers.findIndex(h => NAME_KEYS.some(k => h.includes(k)));
    const personIdx = headers.findIndex(h => PERSON_KEYS.some(k => h.includes(k)));

    for (const line of lines.slice(1, 300)) {
      const cols = splitLine(line, sep);
      if (vendorIdx >= 0 && cols[vendorIdx]?.length > 2) {
        entities.push({ name: cols[vendorIdx], type: 'recipient' });
      } else if (personIdx >= 0 && cols[personIdx]?.length > 2) {
        entities.push({ name: cols[personIdx], type: 'person' });
      }
    }
  } else if (fileType === 'json') {
    try {
      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : ((data as Record<string, unknown>).data || [data]);
      for (const item of (items as unknown[]).slice(0, 300)) {
        if (typeof item !== 'object' || !item) continue;
        const obj = item as Record<string, unknown>;
        const vendorKey = Object.keys(obj).find(k => NAME_KEYS.some(kw => k.toLowerCase().includes(kw)));
        const personKey = Object.keys(obj).find(k => PERSON_KEYS.some(kw => k.toLowerCase().includes(kw)));
        if (vendorKey && String(obj[vendorKey]).length > 2) {
          entities.push({ name: String(obj[vendorKey]), type: 'recipient' });
        } else if (personKey && String(obj[personKey]).length > 2) {
          entities.push({ name: String(obj[personKey]), type: 'person' });
        }
      }
    } catch { /* skip */ }
  }

  // Deduplicate
  const seen = new Set<string>();
  return entities.filter(e => {
    const k = e.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function monitorUser(userId: number, email: string, orgName: string | null) {
  const files = orgFileQueries.listByUser.all(userId);
  if (files.length === 0) return;

  const allEntities: Entity[] = [];
  for (const f of files) {
    if (!f.content) continue;
    allEntities.push(...extractEntities(f.content, f.file_type));
  }

  // Shuffle slightly and take a sample so we rotate through entities over time
  const sample = allEntities.sort(() => Math.random() - 0.5).slice(0, MAX_ENTITIES_PER_RUN);

  for (const entity of sample) {
    try {
      const result = await aiAnalyzeEntity(entity.name, entity.type);
      if (result.overallScore < ALERT_THRESHOLD) continue;

      // Skip if we already alerted on this entity in the last 24h
      const recent = alertQueries.findRecentByEntity.get(userId, entity.name);
      if (recent) continue;

      const analysisPath = `/analysis/${entity.type}/${encodeURIComponent(entity.name)}`;
      const appUrl = process.env.APP_URL || 'https://papertrail.io';
      const analysisUrl = `${appUrl}${analysisPath}`;

      const ins = alertQueries.create.run(
        userId,
        `${result.riskLevel} Risk: ${entity.name}`,
        result.summary,
        result.riskLevel,
        entity.name,
        entity.type,
        result.overallScore,
        analysisPath,
      );
      const alertId = ins.lastInsertRowid as number;

      // Email notification
      const emailOk = await sendCorruptionAlertEmail(email, {
        entityName: entity.name,
        severity: result.riskLevel,
        description: result.summary,
        analysisUrl,
        orgName: orgName ?? undefined,
      });
      if (emailOk) alertQueries.markEmailSent.run(alertId);

      // Push notification
      const pushSent = await sendPushNotification(userId, {
        title: `⚠️ ${result.riskLevel}: ${entity.name}`,
        body: result.summary.slice(0, 120),
        url: analysisPath,
      });
      if (pushSent > 0) alertQueries.markPushSent.run(alertId);

      console.log(`[monitor] Alert created for user ${userId}: ${entity.name} (score ${result.overallScore})`);
    } catch (e) {
      console.error(`[monitor] Error analyzing ${entity.name}:`, e);
    }
  }
}

export function startMonitor() {
  const intervalMs = parseInt(process.env.MONITOR_INTERVAL_MS || String(60 * 60 * 1000)); // 1 hour

  async function runCycle() {
    const users = userQueries_extra.listAllActive.all();
    console.log(`[monitor] Checking ${users.length} active users`);
    for (const user of users) {
      await monitorUser(user.id, user.email, user.org_display_name ?? user.org_name).catch(() => {});
    }
  }

  // Run first cycle 5 minutes after startup to let the server warm up
  setTimeout(() => {
    runCycle().catch(() => {});
    setInterval(() => runCycle().catch(() => {}), intervalMs);
  }, 5 * 60 * 1000);

  console.log(`[monitor] Started — cycle every ${intervalMs / 60000}min`);
}
