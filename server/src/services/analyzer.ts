import { Award, CorruptionAnalysis, Evidence, ResponsibleParty, RiskFactor } from '../types';

// Minimal local shape for regulatory/legal document records
interface RegulatoryDocument {
  document_number: string;
  title: string;
  abstract: string;
  publication_date: string;
  html_url?: string;
  type?: string;
  agencies?: { name: string }[];
}

export function fmt(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function getRiskLevel(score: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (score >= 70) return 'CRITICAL';
  if (score >= 45) return 'HIGH';
  if (score >= 22) return 'MODERATE';
  return 'LOW';
}

function analyzeCompetition(awards: Award[]): RiskFactor | null {
  const contracts = awards.filter(a => ['A','B','C','D'].includes(a['Award Type']));
  if (!contracts.length) return null;

  const nonCompeted = contracts.filter(a => {
    const ec = (a['Extent Competed'] || '').toUpperCase();
    return ec.includes('NOT COMPETED') || ec.includes('NOT AVAILABLE') || ec.includes('ONLY ONE');
  });
  if (!nonCompeted.length) return null;

  const ncAmt  = nonCompeted.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const totAmt = contracts.reduce((s, a)   => s + (a['Award Amount'] || 0), 0);
  const pct    = totAmt > 0 ? (ncAmt / totAmt) * 100 : 0;

  const evidence: Evidence[] = nonCompeted.slice(0, 6).map(a => ({
    id: a['Award ID'], type: 'contract',
    title:       `No-Bid Contract — ${a['Award ID']}`,
    description: `${fmt(a['Award Amount'])} awarded to ${a['Recipient Name']} by ${a['Awarding Agency']} with no competitive bidding ("${a['Extent Competed'] || 'N/A'}").`,
    amount:    a['Award Amount'],
    date:      a['Start Date'],
    sourceUrl: null,
    sourceLabel: 'Connected data',
    severity: a['Award Amount'] >= 10_000_000 ? 'critical' : 'high',
    confidence: 92,
    sources: ['Connected data'],
  }));

  return {
    name: 'Non-Competitive / No-Bid Awards',
    score: Math.min(35, 8 + (pct / 100) * 27),
    weight: 0.30,
    description: `${nonCompeted.length} of ${contracts.length} contracts (${pct.toFixed(0)}% by value, ${fmt(ncAmt)}) were awarded without competitive bidding.`,
    detail: `Sole-source and no-bid contracts bypass market pricing, enabling inflated costs and favoritism.`,
    evidence,
  };
}

function analyzeConcentration(awards: Award[]): RiskFactor | null {
  if (awards.length < 4) return null;
  const map: Record<string, { count: number; amount: number }> = {};
  for (const a of awards) {
    const n = a['Recipient Name'] || 'Unknown';
    if (!map[n]) map[n] = { count: 0, amount: 0 };
    map[n].count  += 1;
    map[n].amount += a['Award Amount'] || 0;
  }
  const sorted = Object.entries(map).sort((a, b) => b[1].amount - a[1].amount);
  if (sorted.length < 2) return null;

  const total   = awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const [topName, topStats] = sorted[0];
  const topPct = total > 0 ? (topStats.amount / total) * 100 : 0;
  if (topPct < 45) return null;

  const evidence: Evidence[] = awards
    .filter(a => a['Recipient Name'] === topName).slice(0, 5)
    .map(a => ({
      id: a['Award ID'], type: 'pattern' as const,
      title:       `Concentrated Award — ${a['Award ID']}`,
      description: `${fmt(a['Award Amount'])} to ${a['Recipient Name']}. This vendor received ${topPct.toFixed(0)}% of all spending.`,
      amount:    a['Award Amount'],
      date:      a['Start Date'],
      sourceUrl: null,
      sourceLabel: 'Connected data',
      severity: topPct >= 75 ? 'critical' : 'high',
      confidence: 90,
      sources: ['Connected data'],
    }));

  return {
    name: 'Award Concentration Risk',
    score: Math.min(25, (topPct / 100) * 25),
    weight: 0.22,
    description: `${topName} received ${topPct.toFixed(0)}% of all spending (${fmt(topStats.amount)} across ${topStats.count} awards).`,
    detail: `Extreme concentration with a single vendor eliminates competitive pricing and is a recognised pattern in procurement fraud.`,
    evidence,
  };
}

function analyzeEmergencyJustifications(awards: Award[]): RiskFactor | null {
  const contracts = awards.filter(a => ['A','B','C','D'].includes(a['Award Type']));
  const urgency = contracts.filter(a => {
    const ec   = (a['Extent Competed'] || '').toUpperCase();
    const desc = (a['Description'] || '').toUpperCase();
    return ec.includes('URGENCY') || desc.includes('EMERGENCY') || desc.includes('COMPELLING URGENCY');
  });
  if (urgency.length < 2) return null;

  const amount = urgency.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const evidence: Evidence[] = urgency.slice(0, 5).map(a => ({
    id: a['Award ID'], type: 'contract' as const,
    title:       `Emergency Justification — ${a['Award ID']}`,
    description: `${fmt(a['Award Amount'])} awarded under urgency exception to ${a['Recipient Name']}.`,
    amount:    a['Award Amount'],
    date:      a['Start Date'],
    sourceUrl: null,
    sourceLabel: 'Connected data',
    severity: urgency.length >= 5 ? 'critical' : 'high',
    confidence: 88,
    sources: ['Connected data'],
  }));

  return {
    name: 'Emergency / Urgency Exception Abuse',
    score: Math.min(20, urgency.length * 3),
    weight: 0.18,
    description: `${urgency.length} contracts (${fmt(amount)}) relied on emergency exceptions to bypass competition.`,
    detail: `Recurring "emergency" justifications are a common pattern in procurement fraud investigations.`,
    evidence,
  };
}

function analyzeRiskyContractTypes(awards: Award[]): RiskFactor | null {
  const risky = awards.filter(a => {
    const pricing = (a['Type of Contract Pricing'] || '').toUpperCase();
    return pricing.includes('COST') || pricing.includes('TIME AND MATERIAL') || pricing.includes('LABOR HOUR');
  });
  if (risky.length < 3) return null;

  const amount = risky.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const evidence: Evidence[] = risky.slice(0, 4).map(a => ({
    id: a['Award ID'], type: 'contract' as const,
    title:       `High-Risk Contract Type — ${a['Award ID']}`,
    description: `${fmt(a['Award Amount'])} contract with pricing "${a['Type of Contract Pricing']}" awarded to ${a['Recipient Name']}.`,
    amount:    a['Award Amount'],
    date:      a['Start Date'],
    sourceUrl: null,
    sourceLabel: 'Connected data',
    severity: 'medium',
    confidence: 85,
    sources: ['Connected data'],
  }));

  return {
    name: 'High-Risk Contract Structures',
    score: Math.min(15, risky.length * 2.5),
    weight: 0.12,
    description: `${risky.length} cost-plus or time-and-materials contracts (${fmt(amount)}) shift cost overrun risk to the buyer.`,
    detail: `Cost-reimbursement and T&M contracts have no ceiling on cost exposure and are frequently associated with overcharging.`,
    evidence,
  };
}

function analyzeSingleBid(awards: Award[]): RiskFactor | null {
  const contracts = awards.filter(a => ['A','B','C','D'].includes(a['Award Type']));
  const single = contracts.filter(a =>
    (a['Number of Offers Received'] === 1 || a['Number of Offers Received'] === 0) &&
    (a['Award Amount'] || 0) >= 500_000
  );
  if (single.length < 2) return null;

  const amount = single.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const evidence: Evidence[] = single.slice(0, 5).map(a => ({
    id: a['Award ID'], type: 'contract' as const,
    title:       `Single-Bid Contract — ${a['Award ID']}`,
    description: `${fmt(a['Award Amount'])} contract received only 1 offer. Awarded to ${a['Recipient Name']}.`,
    amount:    a['Award Amount'],
    date:      a['Start Date'],
    sourceUrl: null,
    sourceLabel: 'Connected data',
    severity: 'high',
    confidence: 90,
    sources: ['Connected data'],
  }));

  return {
    name: 'Single-Bid Contracts',
    score: Math.min(20, single.length * 2.8),
    weight: 0.18,
    description: `${single.length} contracts (${fmt(amount)}) received only one bid despite being nominally open competitions.`,
    detail: `Single-bid responses are effectively sole-source awards with competitive cover and produce higher prices.`,
    evidence,
  };
}

function analyzeRegulatoryRecords(docs: RegulatoryDocument[]): RiskFactor | null {
  if (!docs.length) return null;

  const flagged = docs.filter(d => {
    const t = (d.title + ' ' + d.abstract).toUpperCase();
    return t.includes('DEBARMENT') || t.includes('SUSPENSION') || t.includes('FRAUD') ||
           t.includes('FALSE CLAIM') || t.includes('SETTLEMENT') || t.includes('EXCLUSION') ||
           t.includes('MISCONDUCT') || t.includes('PENALTY') || t.includes('VIOLATION');
  });
  if (!flagged.length) return null;

  const evidence: Evidence[] = flagged.slice(0, 5).map(d => ({
    id: d.document_number, type: 'public_record' as const,
    title:       d.title.slice(0, 80),
    description: d.abstract ? d.abstract.slice(0, 280) : 'No abstract available.',
    date:        d.publication_date,
    sourceUrl:   null,
    sourceLabel: 'Connected data',
    severity:    'critical',
    confidence:  95,
    sources:     ['Connected data'],
  }));

  return {
    name: 'Regulatory & Legal Actions on Record',
    score: Math.min(30, flagged.length * 9),
    weight: 0.30,
    description: `${flagged.length} record(s) document debarments, fraud findings, settlements, or sanctions.`,
    detail: `Formal legal findings represent the highest-credibility evidence category.`,
    evidence,
  };
}

function extractResponsibleParties(awards: Award[]): ResponsibleParty[] {
  const parties: ResponsibleParty[] = [];
  const agencyMap: Record<string, { count: number; amount: number }> = {};
  for (const a of awards) {
    const ag = a['Awarding Agency'] || 'Unknown';
    if (!agencyMap[ag]) agencyMap[ag] = { count: 0, amount: 0 };
    agencyMap[ag].count++;
    agencyMap[ag].amount += a['Award Amount'] || 0;
  }
  for (const [name, s] of Object.entries(agencyMap).sort((a, b) => b[1].amount - a[1].amount).slice(0, 3)) {
    parties.push({
      name:         `${name} Leadership`,
      role:         'Awarding Authority',
      organization: name,
      relevance:    `Authorised ${s.count} awards totalling ${fmt(s.amount)}.`,
    });
  }
  return parties;
}

function buildSummary(
  name: string, score: number, level: string,
  factors: RiskFactor[], total: number, count: number,
): string {
  const top = [...factors].sort((a, b) => b.score - a.score)[0];
  const concern = top ? top.name.toLowerCase() : 'spending patterns';
  const verdict =
    level === 'CRITICAL' || level === 'HIGH'
      ? 'Significant anomalies detected — findings warrant review.'
      : level === 'MODERATE'
      ? 'Some irregular patterns detected. Recommend further scrutiny.'
      : 'No major red flags found in the current data.';
  return `Analysis of ${count} records (${fmt(total)}) associated with "${name}" yielded a risk score of ${score}/100 (${level}). Primary concern: ${concern}. ${verdict}`;
}

export function analyzeEntity(
  entityName: string,
  entityType: 'recipient' | 'agency' | 'person',
  awards: Award[],
  docs: RegulatoryDocument[] = [],
): CorruptionAnalysis {
  const rawFactors: (RiskFactor | null)[] = [
    analyzeCompetition(awards),
    entityType !== 'recipient' ? analyzeConcentration(awards) : null,
    analyzeEmergencyJustifications(awards),
    analyzeRiskyContractTypes(awards),
    analyzeSingleBid(awards),
    analyzeRegulatoryRecords(docs),
  ];

  const factors = rawFactors.filter((f): f is RiskFactor => f !== null);
  const overallScore = Math.min(100, Math.round(factors.reduce((s, f) => s + f.score, 0)));
  const totalAmount  = awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const topContracts = [...awards].sort((a, b) => (b['Award Amount'] || 0) - (a['Award Amount'] || 0)).slice(0, 10);

  return {
    entityName,
    entityType,
    overallScore,
    riskLevel: getRiskLevel(overallScore),
    riskFactors: factors,
    responsibleParties: extractResponsibleParties(awards),
    totalAwards:  awards.length,
    totalAmount,
    topContracts,
    summary:     buildSummary(entityName, overallScore, getRiskLevel(overallScore), factors, totalAmount, awards.length),
    dataSource:  'Connected data',
    lastUpdated: new Date().toISOString(),
  };
}
