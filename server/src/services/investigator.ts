import {
  searchAwardsByKeyword,
  searchAwardsByRecipient,
  searchAwardsByAgency,
  getSpendingOverTime,
  getSoleSourceAwards,
} from './usaSpending';
import { analyzeEntity } from './analyzer';
import { Award, CorruptionAnalysis, SpendingOverTime } from '../types';

export type EntityType = 'recipient' | 'agency' | 'person';

export interface InvestigationEntity {
  name: string;
  type: EntityType;
}

export type InvestigationEvent =
  | { type: 'investigation_started'; entities: InvestigationEntity[]; totalQueued: number }
  | { type: 'entity_queued'; name: string; entityType: EntityType; depth: number; reason: string; discoveredFrom: string }
  | { type: 'entity_fetching'; name: string; entityType: EntityType }
  | { type: 'entity_complete'; name: string; entityType: EntityType; analysis: CorruptionAnalysis; spendingOverTime: SpendingOverTime[] }
  | { type: 'entity_error'; name: string; entityType: EntityType; error: string }
  | { type: 'investigation_complete'; totalAnalyzed: number; criticalCount: number; highCount: number; totalAmount: number; topRisk: { name: string; score: number; level: string }[] };

async function fetchEntityData(
  entity: InvestigationEntity
): Promise<{ awards: Award[]; spendingOverTime: SpendingOverTime[] }> {
  const endDate = new Date().toISOString().split('T')[0];

  const [primary, keyword, soleSource] = await Promise.allSettled([
    entity.type === 'recipient'
      ? searchAwardsByRecipient(entity.name, 1, 100)
      : entity.type === 'agency'
      ? searchAwardsByAgency(entity.name, 1, 100)
      : searchAwardsByKeyword(entity.name, 1, 100),
    searchAwardsByKeyword(entity.name, 1, 50),
    getSoleSourceAwards(entity.name, 30),
  ]);

  const seenIds = new Set<string>();
  const allAwards: Award[] = [];

  for (const r of [primary, keyword, soleSource]) {
    if (r.status !== 'fulfilled') continue;
    const awards = Array.isArray(r.value) ? r.value : ((r.value as { results?: Award[] }).results ?? []);
    for (const a of awards) {
      if (!seenIds.has(a['Award ID'])) {
        seenIds.add(a['Award ID']);
        allAwards.push(a);
      }
    }
  }

  const timeFilters: Record<string, unknown> = {
    award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],
    time_period: [{ start_date: '2018-01-01', end_date: endDate }],
  };
  if (entity.type === 'recipient') timeFilters.recipient_search_text = [entity.name];
  else if (entity.type === 'agency') timeFilters.agencies = [{ type: 'awarding', tier: 'toptier', name: entity.name }];
  else timeFilters.keywords = [entity.name];

  const spendingOverTime = await getSpendingOverTime(timeFilters).catch(() => []);

  return { awards: allAwards, spendingOverTime };
}

function discoverRelated(
  entity: InvestigationEntity,
  analysis: CorruptionAnalysis
): Array<InvestigationEntity & { reason: string; discoveredFrom: string }> {
  const discovered: Array<InvestigationEntity & { reason: string; discoveredFrom: string }> = [];

  if (entity.type === 'recipient') {
    const agencyMap: Record<string, number> = {};
    for (const c of analysis.topContracts) {
      const ag = c['Awarding Agency'];
      if (ag) agencyMap[ag] = (agencyMap[ag] || 0) + (c['Award Amount'] || 0);
    }
    const top = Object.entries(agencyMap).sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const [name] of top) {
      discovered.push({ name, type: 'agency', reason: `Top awarding agency for ${entity.name}`, discoveredFrom: entity.name });
    }
  } else if (entity.type === 'agency') {
    const noBid = [
      ...new Set(
        analysis.topContracts
          .filter((c) => (c['Extent Competed'] || '').toUpperCase().includes('NOT COMPETED'))
          .map((c) => c['Recipient Name'])
          .filter(Boolean)
      ),
    ].slice(0, 3);

    for (const name of noBid) {
      discovered.push({ name, type: 'recipient', reason: `Received no-bid contracts from ${entity.name}`, discoveredFrom: entity.name });
    }

    if (analysis.topContracts.length > 0) {
      const top = analysis.topContracts[0]['Recipient Name'];
      if (top && !noBid.includes(top)) {
        discovered.push({ name: top, type: 'recipient', reason: `Largest single contractor under ${entity.name}`, discoveredFrom: entity.name });
      }
    }
  } else {
    const recipients = [
      ...new Set(analysis.topContracts.map((c) => c['Recipient Name']).filter(Boolean)),
    ].slice(0, 2);
    for (const name of recipients) {
      discovered.push({ name, type: 'recipient', reason: `Associated entity in "${entity.name}" keyword investigation`, discoveredFrom: entity.name });
    }
    const agencies = [
      ...new Set(analysis.topContracts.map((c) => c['Awarding Agency']).filter(Boolean)),
    ].slice(0, 1);
    for (const name of agencies) {
      discovered.push({ name, type: 'agency', reason: `Awarding agency found in "${entity.name}" investigation`, discoveredFrom: entity.name });
    }
  }

  return discovered;
}

export async function runInvestigation(
  primaryEntities: InvestigationEntity[],
  onEvent: (event: InvestigationEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const MAX_TOTAL = 10;
  const MAX_DEPTH = 1;

  type QueueItem = { entity: InvestigationEntity; depth: number; discoveredFrom?: string; reason?: string };
  const queue: QueueItem[] = primaryEntities.map((e) => ({ entity: e, depth: 0 }));
  const analyzed = new Set<string>();
  const allAnalyses: CorruptionAnalysis[] = [];

  onEvent({ type: 'investigation_started', entities: primaryEntities, totalQueued: primaryEntities.length });

  while (queue.length > 0 && analyzed.size < MAX_TOTAL) {
    if (signal?.aborted) break;

    const batch = queue.splice(0, 3);

    await Promise.all(
      batch.map(async ({ entity, depth, discoveredFrom, reason }) => {
        const key = `${entity.type}:${entity.name.toLowerCase().trim()}`;
        if (analyzed.has(key)) return;
        analyzed.add(key);

        onEvent({ type: 'entity_fetching', name: entity.name, entityType: entity.type });

        try {
          const { awards, spendingOverTime } = await fetchEntityData(entity);
          const analysis = analyzeEntity(entity.name, entity.type, awards);
          allAnalyses.push(analysis);

          onEvent({ type: 'entity_complete', name: entity.name, entityType: entity.type, analysis, spendingOverTime });

          if (depth < MAX_DEPTH && analyzed.size < MAX_TOTAL) {
            const discovered = discoverRelated(entity, analysis);
            for (const d of discovered) {
              const dKey = `${d.type}:${d.name.toLowerCase().trim()}`;
              const alreadyQueued = queue.some(
                (q) => `${q.entity.type}:${q.entity.name.toLowerCase().trim()}` === dKey
              );
              if (!analyzed.has(dKey) && !alreadyQueued) {
                onEvent({
                  type: 'entity_queued',
                  name: d.name,
                  entityType: d.type,
                  depth: depth + 1,
                  reason: d.reason,
                  discoveredFrom: d.discoveredFrom,
                });
                queue.push({ entity: { name: d.name, type: d.type }, depth: depth + 1, discoveredFrom: d.discoveredFrom, reason: d.reason });
              }
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Analysis failed';
          onEvent({ type: 'entity_error', name: entity.name, entityType: entity.type, error: msg });
        }
      })
    );
  }

  const criticalCount = allAnalyses.filter((a) => a.riskLevel === 'CRITICAL').length;
  const highCount = allAnalyses.filter((a) => a.riskLevel === 'HIGH').length;
  const totalAmount = allAnalyses.reduce((s, a) => s + a.totalAmount, 0);
  const topRisk = [...allAnalyses]
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 5)
    .map((a) => ({ name: a.entityName, score: a.overallScore, level: a.riskLevel }));

  onEvent({ type: 'investigation_complete', totalAnalyzed: analyzed.size, criticalCount, highCount, totalAmount, topRisk });
}
