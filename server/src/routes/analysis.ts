import { Router, Request, Response } from 'express';
import {
  searchAwardsByKeyword, searchAwardsByRecipient, searchAwardsByAgency,
  getSpendingOverTime, getSoleSourceAwards, fetchRecipientProfile,
} from '../services/usaSpending';
import { searchFederalRegister, searchDebarments } from '../services/federalRegister';
import { analyzeEntity } from '../services/analyzer';
import { aiAnalyzeEntity } from '../services/aiAnalyzer';

const router = Router();

// ── Fallback: rule-based analysis used when ANTHROPIC_API_KEY is absent ──

async function gatherAwards(type: 'recipient' | 'agency' | 'person', name: string) {
  const [primary, keyword, soleSource] = await Promise.allSettled([
    type === 'recipient' ? searchAwardsByRecipient(name, 1, 100)
    : type === 'agency'  ? searchAwardsByAgency(name, 1, 100)
    :                      searchAwardsByKeyword(name, 1, 100),
    searchAwardsByKeyword(name, 1, 50),
    getSoleSourceAwards(name, 50),
  ]);
  const seen = new Set<string>();
  const all = [];
  for (const r of [primary, keyword, soleSource]) {
    if (r.status !== 'fulfilled') continue;
    const list = Array.isArray(r.value) ? r.value : (r.value as { results?: unknown[] }).results ?? [];
    for (const a of list as { 'Award ID': string }[]) {
      if (!seen.has(a['Award ID'])) { seen.add(a['Award ID']); all.push(a); }
    }
  }
  return all;
}

async function gatherFedRegDocs(name: string) {
  const [general, sanctions] = await Promise.allSettled([
    searchFederalRegister(name, 6),
    searchDebarments(name, 5),
  ]);
  const seen = new Set<string>();
  const all = [];
  for (const r of [general, sanctions]) {
    if (r.status !== 'fulfilled') continue;
    for (const d of r.value) {
      if (!seen.has(d.document_number)) { seen.add(d.document_number); all.push(d); }
    }
  }
  return all;
}

async function gatherSpendingOverTime(type: 'recipient' | 'agency' | 'person', name: string) {
  const endDate = new Date().toISOString().split('T')[0];
  const filters: Record<string, unknown> = {
    award_type_codes: ['A','B','C','D','02','03','04','05'],
    time_period: [{ start_date: '2018-01-01', end_date: endDate }],
  };
  if (type === 'recipient') filters.recipient_search_text = [name];
  else if (type === 'agency') filters.agencies = [{ type: 'awarding', tier: 'toptier', name }];
  else filters.keywords = [name];
  return getSpendingOverTime(filters).catch(() => []);
}

async function buildFallbackAnalysis(type: 'recipient' | 'agency' | 'person', name: string) {
  const [awards, fedRegDocs, spendingOverTime, profile] = await Promise.all([
    gatherAwards(type, name),
    gatherFedRegDocs(name),
    gatherSpendingOverTime(type, name),
    type === 'recipient' ? fetchRecipientProfile(name).catch(() => null) : Promise.resolve(null),
  ]);
  const analysis = analyzeEntity(name, type, awards as Parameters<typeof analyzeEntity>[2], fedRegDocs);
  return {
    ...analysis, spendingOverTime, profile,
    sourcesQueried: [
      'USASpending.gov — Federal Contracts & Grants',
      'FederalRegister.gov — Regulatory & Legal Records',
      ...(profile ? ['USASpending.gov Recipient Profile'] : []),
    ],
  };
}

async function buildAnalysis(type: 'recipient' | 'agency' | 'person', name: string) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await aiAnalyzeEntity(name, type);
    } catch (err) {
      console.error('[AI analysis failed — falling back to rule-based]', err instanceof Error ? err.message : err);
    }
  }
  return buildFallbackAnalysis(type, name);
}

router.get('/recipient/:name', async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  try { res.json(await buildAnalysis('recipient', name)); }
  catch (e) { console.error(e); res.status(502).json({ error: 'Failed to analyze recipient.' }); }
});

router.get('/agency/:name', async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  try { res.json(await buildAnalysis('agency', name)); }
  catch (e) { console.error(e); res.status(502).json({ error: 'Failed to analyze agency.' }); }
});

router.get('/person/:name', async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name);
  try { res.json(await buildAnalysis('person', name)); }
  catch (e) { console.error(e); res.status(502).json({ error: 'Failed to analyze person/keyword.' }); }
});

export default router;
