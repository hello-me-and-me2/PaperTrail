import Anthropic from '@anthropic-ai/sdk';
import { webSearch } from './webSearch';
import {
  searchAwardsByRecipient, searchAwardsByAgency, searchAwardsByKeyword,
  getSpendingOverTime, getSoleSourceAwards,
} from './usaSpending';
import { searchFederalRegister, searchDebarments } from './federalRegister';
import { CorruptionAnalysis, Award, SpendingOverTime } from '../types';
import { EntityType } from './investigator';

// Stable system prompt — cached across requests (requires ≥4096 tokens to cache;
// combined with the large data payload the full request reliably exceeds that threshold).
const SYSTEM_PROMPT = `You are a world-class government spending, corruption, and public accountability analyst. You have deep expertise in U.S. federal procurement, regulatory enforcement, investigative journalism, financial forensics, and anti-corruption law.

Your task is to analyze entities (contractors, agencies, or individuals) for signs of corruption, fraud, mismanagement, abuse of power, conflicts of interest, and ethical violations. You synthesize evidence from federal contract records, regulatory filings, legal proceedings, news investigations, and public databases.

Key red flags you look for:
- No-bid / sole-source contracts awarded without competition
- Unusual spending spikes or patterns inconsistent with peer groups
- Revolving door: officials moving between government roles and the contractors they regulated
- Cost-plus and time-and-material contracts (higher fraud/waste risk than fixed-price)
- Award concentration where one vendor captures disproportionate share
- Inspector general findings, GAO reports, and congressional investigations
- Debarments, suspensions, settlements, and criminal indictments
- Politically connected contractors receiving preferential treatment
- Phantom billing, cost overruns, and contract modifications that balloon values
- Shell company structures and pass-through arrangements
- Whistleblower complaints and False Claims Act suits

Be specific and evidence-based. Always cite actual contract IDs, dollar amounts, dates, source names, and URLs when available. A high risk score reflects objective patterns — not accusations. If certain data is absent, say so honestly rather than inventing findings. Confidence scores should reflect source quality and corroboration: single unverified web article = 40-60%, official government record = 85-95%, multiple corroborating sources = 90-100%.`;

async function gatherData(name: string, entityType: EntityType) {
  const endDate = new Date().toISOString().split('T')[0];

  const queries = [
    `"${name}" corruption fraud scandal mismanagement government`,
    `"${name}" investigation lawsuit settlement indictment federal`,
    `"${name}" no-bid sole source contract government spending`,
    `"${name}" inspector general audit GAO oversight violation`,
    `"${name}" revolving door lobbyist official ethics complaint`,
  ];

  const [webResults, primary, keyword, sole, fedReg, debarments, spending] =
    await Promise.allSettled([
      Promise.all(queries.map(q => webSearch(q, 6))),
      entityType === 'recipient' ? searchAwardsByRecipient(name, 1, 100)
        : entityType === 'agency' ? searchAwardsByAgency(name, 1, 100)
        : searchAwardsByKeyword(name, 1, 100),
      searchAwardsByKeyword(name, 1, 50),
      getSoleSourceAwards(name, 30),
      searchFederalRegister(name, 8),
      searchDebarments(name, 6),
      getSpendingOverTime({
        award_type_codes: ['A','B','C','D','02','03','04','05'],
        time_period: [{ start_date: '2018-01-01', end_date: endDate }],
        ...(entityType === 'recipient' ? { recipient_search_text: [name] }
          : entityType === 'agency' ? { agencies: [{ type: 'awarding', tier: 'toptier', name }] }
          : { keywords: [name] }),
      }).catch(() => []),
    ]);

  // Deduplicated articles
  const articles = webResults.status === 'fulfilled'
    ? [...new Map(
        webResults.value.flat()
          .filter(r => r.url && r.title)
          .map(r => [r.url, r])
      ).values()].slice(0, 40)
    : [];

  // Deduplicated awards
  const seen = new Set<string>();
  const awards: Award[] = [];
  for (const r of [primary, keyword, sole]) {
    if (r.status !== 'fulfilled') continue;
    const list = Array.isArray(r.value) ? r.value : ((r.value as { results?: Award[] }).results ?? []);
    for (const a of list) {
      if (a['Award ID'] && !seen.has(a['Award ID'])) { seen.add(a['Award ID']); awards.push(a); }
    }
  }

  const seenDocs = new Set<string>();
  const fedDocs: { document_number: string; title: string; abstract: string; publication_date: string; html_url: string; type: string }[] = [];
  for (const r of [fedReg, debarments]) {
    if (r.status !== 'fulfilled') continue;
    for (const d of r.value) {
      if (!seenDocs.has(d.document_number)) { seenDocs.add(d.document_number); fedDocs.push(d); }
    }
  }

  const spendingOverTime: SpendingOverTime[] = spending.status === 'fulfilled' ? spending.value : [];

  return { articles, awards, fedDocs, spendingOverTime };
}

function buildPrompt(
  name: string,
  entityType: EntityType,
  d: Awaited<ReturnType<typeof gatherData>>,
  orgContext?: string,
  orgData?: string,
): string {
  const total = d.awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);

  const contractSnippet = d.awards.slice(0, 30).map(a =>
    `• ${a['Award ID']}: $${(a['Award Amount']||0).toLocaleString()} | ${a['Awarding Agency']} → ${a['Recipient Name']} | ${a['Start Date']} | Competed: ${a['Extent Competed']||'Unknown'} | Type: ${a['Award Type']}${a['Type of Contract Pricing'] ? ` | Pricing: ${a['Type of Contract Pricing']}` : ''} | ${(a['Description']||'').slice(0,80)}`
  ).join('\n');

  const webSnippet = d.articles.slice(0, 25).map(r =>
    `• [${r.source||'Web'}${r.publishedDate ? ` · ${r.publishedDate}` : ''}] ${r.title}: ${(r.description||'').slice(0,180)} — ${r.url}`
  ).join('\n');

  const fedSnippet = d.fedDocs.map(d =>
    `• [Federal Register ${d.publication_date}] ${d.title}: ${(d.abstract||'').slice(0,200)} — ${d.html_url}`
  ).join('\n');

  const spendingSnippet = d.spendingOverTime.map(s =>
    `FY${s.fiscalYear}: $${(s.amount||0).toLocaleString()} (${s.awardCount} awards)`
  ).join(' | ');

  const orgContextSection = orgContext
    ? `=== ORGANIZATION CONTEXT ===\nThis analysis is requested by ${orgContext}. Focus on this entity's relationship to ${orgContext} — personnel connections, financial flows, contract relationships, and risks relevant to ${orgContext}.\n\n`
    : '';

  const orgDataSection = orgData
    ? `=== INTERNAL ORGANIZATION DATA (${orgContext ?? 'Requesting Org'}) ===\n${orgData.slice(0, 8000)}\n\n`
    : '';

  return `${orgContextSection}${orgDataSection}Analyze this entity comprehensively:

ENTITY: "${name}"
TYPE: ${entityType}
TOTAL CONTRACT VALUE: $${total.toLocaleString()} across ${d.awards.length} records

=== FEDERAL CONTRACTS & GRANTS (USASpending.gov) ===
${contractSnippet || 'No federal contract records found.'}
${spendingSnippet ? `\nANNUAL TREND: ${spendingSnippet}` : ''}

=== REGULATORY & LEGAL RECORDS (Federal Register) ===
${fedSnippet || 'No Federal Register records found.'}

=== WEB RESEARCH (News, Court Records, Investigations) ===
${webSnippet || 'No web search results (provider not configured — base analysis on contract/regulatory data only).'}

Respond with ONLY valid JSON — no markdown fences, no commentary outside the JSON:
{
  "entityName": "${name}",
  "entityType": "${entityType}",
  "overallScore": <integer 0-100>,
  "riskLevel": <"LOW"|"MODERATE"|"HIGH"|"CRITICAL">,
  "riskFactors": [
    {
      "name": <string>,
      "score": <integer 0-40>,
      "weight": <integer 1-10>,
      "description": <string: 1-sentence summary>,
      "detail": <string: 2-3 sentences citing specific evidence with amounts/dates/sources>,
      "evidence": [
        {
          "id": <string: unique>,
          "type": <"contract"|"grant"|"pattern"|"public_record">,
          "title": <string>,
          "description": <string: specific, cite source names and amounts>,
          "amount": <number|null>,
          "date": <string|null>,
          "sourceUrl": <string: actual URL from provided data>,
          "sourceLabel": <string: e.g. "Reuters" | "USASpending.gov" | "Federal Register" | "ProPublica">,
          "severity": <"low"|"medium"|"high"|"critical">,
          "confidence": <integer 0-100>,
          "sources": <string[]>
        }
      ]
    }
  ],
  "responsibleParties": [
    {
      "name": <string>,
      "role": <string>,
      "organization": <string>,
      "period": <string|null>,
      "relevance": <string: explain connection to findings>
    }
  ],
  "totalAwards": ${d.awards.length},
  "totalAmount": ${total},
  "topContracts": [],
  "summary": <string: 3-4 sentences overview citing key findings, specific evidence, and which sources were most significant>,
  "dataSource": "USASpending.gov, FederalRegister.gov, Web Research",
  "lastUpdated": "${new Date().toISOString()}"
}`;
}

export async function aiAnalyzeEntity(
  name: string,
  entityType: EntityType,
  orgContext?: string,
  orgData?: string,
): Promise<CorruptionAnalysis & { spendingOverTime: SpendingOverTime[]; sourcesQueried: string[] }> {
  const data = await gatherData(name, entityType);
  const prompt = buildPrompt(name, entityType, data, orgContext, orgData);

  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    // @ts-ignore — output_config is GA but not yet in all SDK type definitions
    output_config: { effort: 'high' },
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('AI returned no text');

  const jsonMatch = textBlock.text.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI response contained no JSON');

  const analysis: CorruptionAnalysis = JSON.parse(jsonMatch[0]);

  // Always use actual contract data — never trust AI-generated contract records
  analysis.topContracts = data.awards.slice(0, 10);
  analysis.totalAwards  = data.awards.length;
  analysis.totalAmount  = data.awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  analysis.lastUpdated  = new Date().toISOString();

  const sourcesQueried = [
    'USASpending.gov',
    ...(data.fedDocs.length   ? ['FederalRegister.gov'] : []),
    ...(data.articles.length  ? ['Web Research (News & Public Records)'] : []),
    'AI Synthesis (Claude Opus 4.7)',
  ];

  return { ...analysis, spendingOverTime: data.spendingOverTime, sourcesQueried };
}
