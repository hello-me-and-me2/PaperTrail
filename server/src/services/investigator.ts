import { analyzeEntity } from './analyzer';
import { aiAnalyzeEntity } from './aiAnalyzer';
import { CorruptionAnalysis, SpendingOverTime } from '../types';

export type EntityType = 'recipient' | 'agency' | 'person';
export interface InvestigationEntity { name: string; type: EntityType; }

export type InvestigationEvent =
  | { type: 'investigation_started'; entities: InvestigationEntity[]; totalQueued: number }
  | { type: 'entity_queued';    name: string; entityType: EntityType; depth: number; reason: string; discoveredFrom: string }
  | { type: 'entity_fetching';  name: string; entityType: EntityType }
  | { type: 'entity_complete';  name: string; entityType: EntityType; analysis: CorruptionAnalysis; spendingOverTime: SpendingOverTime[]; sourcesQueried: string[] }
  | { type: 'entity_error';     name: string; entityType: EntityType; error: string }
  | { type: 'investigation_complete'; totalAnalyzed: number; criticalCount: number; highCount: number; totalAmount: number; topRisk: { name: string; score: number; level: string }[] };

function discoverRelated(entity: InvestigationEntity, analysis: CorruptionAnalysis) {
  const discovered: Array<InvestigationEntity & { reason: string; discoveredFrom: string }> = [];

  for (const party of analysis.responsibleParties.slice(0, 2)) {
    if (party.name && party.name !== entity.name) {
      discovered.push({
        name: party.name,
        type: 'person',
        reason: `${party.role} linked to ${entity.name}`,
        discoveredFrom: entity.name,
      });
    }
  }

  for (const rf of analysis.riskFactors.slice(0, 2)) {
    for (const ev of rf.evidence.slice(0, 1)) {
      const candidateName = ev.title.replace(/^[^—]+—\s*/, '').trim();
      if (candidateName && candidateName !== entity.name && candidateName.length > 3 && candidateName.length < 80) {
        discovered.push({
          name: candidateName,
          type: 'recipient',
          reason: `Flagged in: ${rf.name}`,
          discoveredFrom: entity.name,
        });
      }
    }
  }

  return discovered.slice(0, 3);
}

export async function runInvestigation(
  primaryEntities: InvestigationEntity[],
  onEvent: (e: InvestigationEvent) => void,
  signal?: AbortSignal,
  orgData?: string,
  orgContext?: string,
) {
  const MAX_TOTAL = 10, MAX_DEPTH = 1;
  type Item = { entity: InvestigationEntity; depth: number; discoveredFrom?: string; reason?: string };
  const queue: Item[] = primaryEntities.map(e => ({ entity: e, depth: 0 }));
  const analyzed = new Set<string>();
  const allAnalyses: CorruptionAnalysis[] = [];
  const useAI = !!process.env.ANTHROPIC_API_KEY;

  onEvent({ type: 'investigation_started', entities: primaryEntities, totalQueued: primaryEntities.length });

  while (queue.length > 0 && analyzed.size < MAX_TOTAL) {
    if (signal?.aborted) break;
    const batch = queue.splice(0, 3);

    await Promise.all(batch.map(async ({ entity, depth }) => {
      const key = `${entity.type}:${entity.name.toLowerCase().trim()}`;
      if (analyzed.has(key)) return;
      analyzed.add(key);

      onEvent({ type: 'entity_fetching', name: entity.name, entityType: entity.type });

      try {
        let analysis: CorruptionAnalysis;
        let spendingOverTime: SpendingOverTime[] = [];
        let sourcesQueried: string[];

        if (useAI) {
          const result = await aiAnalyzeEntity(entity.name, entity.type, orgContext, orgData);
          analysis        = result;
          spendingOverTime = result.spendingOverTime;
          sourcesQueried  = result.sourcesQueried;
        } else {
          analysis       = analyzeEntity(entity.name, entity.type, [], []);
          sourcesQueried = orgData
            ? [...orgData.matchAll(/\[SOURCE FILE: ([^\]]+)\]/g)].map(m => m[1])
            : ['Connected data'];
        }

        allAnalyses.push(analysis);
        onEvent({ type: 'entity_complete', name: entity.name, entityType: entity.type, analysis, spendingOverTime, sourcesQueried });

        if (depth < MAX_DEPTH && analyzed.size < MAX_TOTAL) {
          for (const d of discoverRelated(entity, analysis)) {
            const dKey = `${d.type}:${d.name.toLowerCase().trim()}`;
            if (!analyzed.has(dKey) && !queue.find(q => `${q.entity.type}:${q.entity.name.toLowerCase().trim()}` === dKey)) {
              onEvent({ type: 'entity_queued', name: d.name, entityType: d.type, depth: depth + 1, reason: d.reason, discoveredFrom: d.discoveredFrom });
              queue.push({ entity: { name: d.name, type: d.type }, depth: depth + 1 });
            }
          }
        }
      } catch (err) {
        onEvent({ type: 'entity_error', name: entity.name, entityType: entity.type, error: err instanceof Error ? err.message : 'Failed' });
      }
    }));
  }

  const criticalCount = allAnalyses.filter(a => a.riskLevel === 'CRITICAL').length;
  const highCount     = allAnalyses.filter(a => a.riskLevel === 'HIGH').length;
  const totalAmount   = allAnalyses.reduce((s, a) => s + a.totalAmount, 0);
  const topRisk       = [...allAnalyses].sort((a, b) => b.overallScore - a.overallScore).slice(0, 5)
                          .map(a => ({ name: a.entityName, score: a.overallScore, level: a.riskLevel }));

  onEvent({ type: 'investigation_complete', totalAnalyzed: analyzed.size, criticalCount, highCount, totalAmount, topRisk });
}
