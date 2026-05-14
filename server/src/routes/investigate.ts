import { Router, Request, Response } from 'express';
import { runInvestigation, InvestigationEntity } from '../services/investigator';
import { requireAuth, optionalAuth, JwtPayload } from '../middleware/auth';
import db, { alertQueries, scheduleQueries } from '../db';
import { sendCorruptionAlertEmail } from '../services/emailService';
import { sendPushNotification } from '../services/pushService';

const router = Router();
type AuthedReq = Request & { user?: JwtPayload };

// POST /api/investigate/stream — run a live investigation (optional auth for notifications)
router.post('/stream', optionalAuth, async (req: Request, res: Response) => {
  const authedUser = (req as AuthedReq).user;
  const { entities } = req.body as { entities: InvestigationEntity[] };

  if (!Array.isArray(entities) || entities.length === 0) {
    res.status(400).json({ error: 'Provide at least one entity.' });
    return;
  }
  if (entities.length > 5) {
    res.status(400).json({ error: 'Maximum 5 primary entities.' });
    return;
  }
  const valid = entities.every(e => e.name && ['recipient', 'agency', 'person'].includes(e.type));
  if (!valid) {
    res.status(400).json({ error: 'Each entity needs a name and type (recipient|agency|person).' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const send = (eventType: string, data: unknown) => {
    if (!res.writableEnded) res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Resolve user email once if authenticated
  let userEmail: string | null = null;
  const userId = authedUser?.userId ?? null;
  if (userId) {
    const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
    userEmail = row?.email ?? null;
  }

  const appUrl = process.env.APP_URL || '';
  const highRiskCount = { value: 0 };

  try {
    await runInvestigation(
      entities,
      (event) => {
        send(event.type, event);

        // Fire alert + notifications for HIGH/CRITICAL findings
        if (userId && event.type === 'entity_complete') {
          const { analysis, name, entityType } = event;
          if (analysis.overallScore >= 50 && (analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL')) {
            const recent = alertQueries.findRecentByEntity.get(userId, name);
            if (!recent) {
              const analysisPath = `/analysis/${entityType}/${encodeURIComponent(name)}`;
              const ins = alertQueries.create.run(
                userId,
                `${analysis.riskLevel} Risk Detected: ${name}`,
                analysis.summary,
                analysis.riskLevel,
                name,
                entityType,
                analysis.overallScore,
                analysisPath,
              );
              const alertId = ins.lastInsertRowid as number;
              highRiskCount.value++;

              if (userEmail) {
                sendCorruptionAlertEmail(userEmail, {
                  entityName: name,
                  severity: analysis.riskLevel,
                  description: analysis.summary,
                  analysisUrl: `${appUrl}${analysisPath}`,
                }).then(ok => { if (ok) alertQueries.markEmailSent.run(alertId); }).catch(() => {});
              }

              sendPushNotification(userId, {
                title: `⚠️ ${analysis.riskLevel}: ${name}`,
                body: analysis.summary.slice(0, 120),
                url: analysisPath,
              }).then(n => { if (n > 0) alertQueries.markPushSent.run(alertId); }).catch(() => {});
            }
          }
        }

        // Summary push when investigation ends
        if (userId && event.type === 'investigation_complete' && highRiskCount.value > 0) {
          sendPushNotification(userId, {
            title: '🔍 Investigation Complete',
            body: `${highRiskCount.value} high-risk ${highRiskCount.value === 1 ? 'entity' : 'entities'} found. Tap to view alerts.`,
            url: '/alerts',
          }).catch(() => {});
          if (userEmail) {
            sendCorruptionAlertEmail(userEmail, {
              entityName: `Investigation — ${event.totalAnalyzed} entities`,
              severity: event.criticalCount > 0 ? 'CRITICAL' : 'HIGH',
              description: `Investigation complete. Found ${event.criticalCount} CRITICAL and ${event.highCount} HIGH risk entities out of ${event.totalAnalyzed} analyzed. Top risk: ${event.topRisk[0]?.name ?? 'N/A'} (${event.topRisk[0]?.score ?? 0}/100).`,
              analysisUrl: `${appUrl}/alerts`,
            }).catch(() => {});
          }
        }
      },
      controller.signal
    );
  } catch {
    send('error', { message: 'Investigation failed unexpectedly.' });
  }

  if (!res.writableEnded) {
    res.write('event: done\ndata: {}\n\n');
    res.end();
  }
});

// POST /api/investigate/schedule — save a recurring investigation schedule
router.post('/schedule', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as AuthedReq).user!;
  const { entities, durationMs, label } = req.body as {
    entities: InvestigationEntity[];
    durationMs: number;
    label?: string;
  };

  if (!Array.isArray(entities) || entities.length === 0 || !durationMs || durationMs <= 0) {
    res.status(400).json({ error: 'entities and durationMs (> 0) are required.' });
    return;
  }

  const endsAt = new Date(Date.now() + durationMs).toISOString();
  // First background re-run: 1 hour from now (monitor cycle) or half the duration, whichever is shorter
  const nextRunAt = new Date(Date.now() + Math.min(60 * 60 * 1000, Math.floor(durationMs / 2))).toISOString();

  const result = scheduleQueries.create.run(
    userId,
    JSON.stringify(entities),
    label ?? null,
    durationMs,
    endsAt,
    nextRunAt,
  );

  res.json({ id: result.lastInsertRowid, endsAt, nextRunAt });
});

// GET /api/investigate/schedule — list user's schedules
router.get('/schedule', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as AuthedReq).user!;
  const rows = scheduleQueries.listByUser.all(userId);
  res.json(rows.map(r => ({ ...r, entities: JSON.parse(r.entities) })));
});

// DELETE /api/investigate/schedule/:id — stop a schedule
router.delete('/schedule/:id', requireAuth, (req: Request, res: Response) => {
  const { userId } = (req as AuthedReq).user!;
  scheduleQueries.stopById.run(parseInt(req.params.id), userId);
  res.json({ success: true });
});

export default router;
