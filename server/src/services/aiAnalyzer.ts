import Anthropic from '@anthropic-ai/sdk';
import { CorruptionAnalysis, SpendingOverTime } from '../types';
import { EntityType } from './investigator';

const SYSTEM_PROMPT = `You are an internal audit and compliance analyst specializing in financial fraud detection and corruption risk assessment.

Your task is to analyze entities (vendors, employees, departments, or events) for signs of corruption, fraud, mismanagement, conflicts of interest, and financial irregularities — using ONLY the organization's own internal data provided to you.

Key red flags you look for:
- Unusual payment amounts, frequencies, or timing
- Vendors receiving payments with no supporting documentation
- Single-vendor concentration or sole-source patterns
- Round-number or split payments that evade approval thresholds
- Payments to unknown or newly registered vendors
- Related-party transactions or conflicts of interest
- Anomalous spending spikes compared to historical patterns
- Missing approval chains or irregular authorization
- Duplicate invoices or billing irregularities
- Cash-heavy or off-system transactions

Base your analysis EXCLUSIVELY on the internal data provided. Never invent data. If the data is insufficient to reach a conclusion, say so and assign a LOW risk score. Cite specific amounts, dates, and file names from the provided data.`;

function buildPrompt(
  name: string,
  entityType: EntityType,
  orgData: string,
  orgContext?: string,
): string {
  const orgContextSection = orgContext
    ? `=== ORGANIZATION CONTEXT ===\nAnalysis requested by ${orgContext}. Focus on this entity's financial relationships, transactions, and risk indicators relevant to ${orgContext}.\n\n`
    : '';

  const orgFileNames = [...orgData.matchAll(/\[SOURCE FILE: ([^\]]+)\]/g)].map(m => m[1]);
  const fileList = orgFileNames.join(', ') || 'connected data files';

  return `${orgContextSection}Analyze this entity using only the internal data below:

ENTITY: "${name}"
TYPE: ${entityType}
CONNECTED FILES: ${fileList}

IMPORTANT SOURCING RULE: When generating evidence items, use the actual filename from CONNECTED FILES as the sourceLabel (e.g. "vendors_Q2.csv"). Do NOT reference any external websites or public databases.

=== INTERNAL ORGANIZATION DATA ===
${orgData.slice(0, 12000)}

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
      "detail": <string: 2-3 sentences citing specific evidence with amounts/dates/file names>,
      "evidence": [
        {
          "id": <string: unique>,
          "type": <"contract"|"payment"|"pattern"|"internal_record">,
          "title": <string>,
          "description": <string: cite specific values and file names from the data>,
          "amount": <number|null>,
          "date": <string|null>,
          "sourceUrl": null,
          "sourceLabel": <string: filename, e.g. "vendors.csv" — NEVER a website URL>,
          "severity": <"low"|"medium"|"high"|"critical">,
          "confidence": <integer 0-100>,
          "sources": <string[]: list of filenames>
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
      "relevance": <string: explain connection to the findings>
    }
  ],
  "totalAwards": 0,
  "totalAmount": <number: total transaction value found in the data, or 0>,
  "topContracts": [],
  "summary": <string: 3-4 sentences based solely on internal data — cite specific file names and amounts>,
  "dataSource": "${fileList}",
  "lastUpdated": "${new Date().toISOString()}"
}`;
}

export async function aiAnalyzeEntity(
  name: string,
  entityType: EntityType,
  orgContext?: string,
  orgData?: string,
): Promise<CorruptionAnalysis & { spendingOverTime: SpendingOverTime[]; sourcesQueried: string[] }> {
  if (!orgData || orgData.trim().length < 20) {
    throw new Error('No connected data available. Upload files or connect a data source first.');
  }

  const prompt = buildPrompt(name, entityType, orgData, orgContext);

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

  analysis.topContracts = [];
  analysis.lastUpdated  = new Date().toISOString();

  const orgFiles = [...orgData.matchAll(/\[SOURCE FILE: ([^\]]+)\]/g)].map(m => m[1]);
  const sourcesQueried = [
    ...(orgFiles.length > 0 ? orgFiles : ['Connected data']),
    'AI Synthesis (Claude Opus 4.7)',
  ];

  return { ...analysis, spendingOverTime: [], sourcesQueried };
}
