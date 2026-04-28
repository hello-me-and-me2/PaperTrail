import { Award, CorruptionAnalysis, Evidence, ResponsibleParty, RiskFactor } from '../types';
import { FedRegDocument } from './federalRegister';

const USA_SPENDING_BASE = 'https://www.usaspending.gov';
const FED_REG_BASE = 'https://www.federalregister.gov';

function buildAwardUrl(id: string) { return `${USA_SPENDING_BASE}/award/${id}`; }

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

// ─────────────────────────────────────────
// RISK FACTOR 1 — Non-competitive awards
// ─────────────────────────────────────────
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
    description: `${fmt(a['Award Amount'])} awarded to ${a['Recipient Name']} by ${a['Awarding Agency']} with no competitive bidding (reported extent: "${a['Extent Competed'] || 'N/A'}"). FAR Part 6 requires full and open competition unless a written justification is filed.`,
    amount:    a['Award Amount'],
    date:      a['Start Date'],
    sourceUrl: buildAwardUrl(a['Award ID']),
    sourceLabel: 'USASpending.gov — Official Federal Award Record',
    severity: a['Award Amount'] >= 10_000_000 ? 'critical' : 'high',
    confidence: 98,
    sources: ['USASpending.gov'],
  }));

  const score = Math.min(35, 8 + (pct / 100) * 27);
  return {
    name: 'Non-Competitive / No-Bid Awards',
    score, weight: 0.30,
    description: `${nonCompeted.length} of ${contracts.length} contracts (${pct.toFixed(0)}% by value, ${fmt(ncAmt)}) were awarded without competitive bidding.`,
    detail: `Sole-source and no-bid contracts bypass market pricing, enabling inflated costs and favoritism. The FAR (48 CFR Part 6) requires a documented Justification & Approval (J&A) for every non-competitive award, yet audit agencies like the GAO and DOD IG regularly find these inadequate or missing.`,
    evidence,
  };
}

// ─────────────────────────────────────────
// RISK FACTOR 2 — Award concentration
// ─────────────────────────────────────────
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
      description: `${fmt(a['Award Amount'])} to ${a['Recipient Name']}. This single vendor received ${topPct.toFixed(0)}% of all spending in the analysed period.`,
      amount:    a['Award Amount'],
      date:      a['Start Date'],
      sourceUrl: buildAwardUrl(a['Award ID']),
      sourceLabel: 'USASpending.gov',
      severity: topPct >= 75 ? 'critical' : 'high',
      confidence: 95,
      sources: ['USASpending.gov'],
    }));

  const score = Math.min(25, (topPct / 100) * 25);
  return {
    name: 'Award Concentration Risk',
    score, weight: 0.22,
    description: `${topName} received ${topPct.toFixed(0)}% of all analysed spending (${fmt(topStats.amount)} across ${topStats.count} awards).`,
    detail: `Industry and government best-practice recommends no single vendor exceed 30–40% of an agency's category spend. Extreme concentration creates lock-in, eliminates competitive pricing, and is a recognised pattern in procurement fraud investigations (see GAO-22-105491).`,
    evidence,
  };
}

// ─────────────────────────────────────────
// RISK FACTOR 3 — Emergency & urgency abuse
// ─────────────────────────────────────────
function analyzeEmergencyJustifications(awards: Award[]): RiskFactor | null {
  const contracts = awards.filter(a => ['A','B','C','D'].includes(a['Award Type']));
  const urgency = contracts.filter(a => {
    const ec    = (a['Extent Competed'] || '').toUpperCase();
    const desc  = (a['Description'] || '').toUpperCase();
    return ec.includes('URGENCY') || desc.includes('EMERGENCY') || desc.includes('COMPELLING URGENCY');
  });
  if (urgency.length < 2) return null;

  const amount = urgency.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const evidence: Evidence[] = urgency.slice(0, 5).map(a => ({
    id: a['Award ID'], type: 'contract' as const,
    title:       `Emergency Justification — ${a['Award ID']}`,
    description: `${fmt(a['Award Amount'])} awarded under FAR 6.302-2 "Unusual and Compelling Urgency" to ${a['Recipient Name']}. Description: "${(a['Description'] || '').slice(0, 120)}"`,
    amount:    a['Award Amount'],
    date:      a['Start Date'],
    sourceUrl: buildAwardUrl(a['Award ID']),
    sourceLabel: 'USASpending.gov',
    severity: urgency.length >= 5 ? 'critical' : 'high',
    confidence: 90,
    sources: ['USASpending.gov'],
  }));

  const score = Math.min(20, urgency.length * 3);
  return {
    name: 'Emergency / Urgency Exception Abuse',
    score, weight: 0.18,
    description: `${urgency.length} contracts (${fmt(amount)}) relied on emergency or urgency exceptions to bypass competition rules.`,
    detail: `FAR 6.302-2 permits skipping competition only when "unusual and compelling urgency" exists and delay would cause serious harm. The DOJ and IG offices have prosecuted cases where recurring "emergency" justifications were fabricated to steer contracts.`,
    evidence,
  };
}

// ─────────────────────────────────────────
// RISK FACTOR 4 — Cost-plus & T&M contracts
// ─────────────────────────────────────────
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
    description: `${fmt(a['Award Amount'])} contract with pricing type "${a['Type of Contract Pricing']}" awarded to ${a['Recipient Name']}. These contract structures place cost risk on taxpayers.`,
    amount:    a['Award Amount'],
    date:      a['Start Date'],
    sourceUrl: buildAwardUrl(a['Award ID']),
    sourceLabel: 'USASpending.gov',
    severity: 'medium',
    confidence: 88,
    sources: ['USASpending.gov'],
  }));

  const score = Math.min(15, risky.length * 2.5);
  return {
    name: 'High-Risk Contract Structures',
    score, weight: 0.12,
    description: `${risky.length} cost-plus or time-and-materials contracts (${fmt(amount)}) shift cost overrun risk entirely to the government.`,
    detail: `GAO and DCAA audits consistently identify cost-reimbursement and T&M contracts as highest-risk for waste. Unlike fixed-price contracts, these structures have no ceiling on government cost exposure and are frequently associated with overcharging.`,
    evidence,
  };
}

// ─────────────────────────────────────────
// RISK FACTOR 5 — Single-bid contracts
// ─────────────────────────────────────────
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
    description: `${fmt(a['Award Amount'])} contract received only 1 offer. Awarded by ${a['Awarding Agency']} to ${a['Recipient Name']} on ${a['Start Date']}.`,
    amount:    a['Award Amount'],
    date:      a['Start Date'],
    sourceUrl: buildAwardUrl(a['Award ID']),
    sourceLabel: 'USASpending.gov',
    severity: 'high',
    confidence: 96,
    sources: ['USASpending.gov'],
  }));

  const score = Math.min(20, single.length * 2.8);
  return {
    name: 'Single-Bid Contracts',
    score, weight: 0.18,
    description: `${single.length} contracts (${fmt(amount)}) received only one bid despite being nominally open competitions.`,
    detail: `RAND Corporation and GAO research show that solicitations written with overly narrow specifications or short response windows generate single-bid responses that are effectively sole-source awards with competitive cover. Average prices are 8–14% higher on single-bid contracts.`,
    evidence,
  };
}

// ─────────────────────────────────────────
// RISK FACTOR 6 — Regulatory / legal flags (Federal Register)
// ─────────────────────────────────────────
function analyzeRegulatoryRecords(fedRegDocs: FedRegDocument[]): RiskFactor | null {
  if (!fedRegDocs.length) return null;

  const flagged = fedRegDocs.filter(d => {
    const t = (d.title + ' ' + d.abstract).toUpperCase();
    return t.includes('DEBARMENT') || t.includes('SUSPENSION') || t.includes('FRAUD') ||
           t.includes('FALSE CLAIM') || t.includes('SETTLEMENT') || t.includes('EXCLUSION') ||
           t.includes('MISCONDUCT') || t.includes('PENALTY') || t.includes('VIOLATION');
  });
  if (!flagged.length) return null;

  const evidence: Evidence[] = flagged.slice(0, 5).map(d => ({
    id: d.document_number, type: 'public_record' as const,
    title:       `Federal Register: ${d.title.slice(0, 80)}`,
    description: d.abstract ? d.abstract.slice(0, 280) : 'No abstract available.',
    date:      d.publication_date,
    sourceUrl: d.html_url || `${FED_REG_BASE}/documents/${d.document_number}`,
    sourceLabel: 'FederalRegister.gov — Official U.S. Government Record',
    severity: 'critical',
    confidence: 99,
    sources: ['FederalRegister.gov'],
  }));

  const score = Math.min(30, flagged.length * 9);
  return {
    name: 'Regulatory & Legal Actions on Record',
    score, weight: 0.30,
    description: `${flagged.length} Federal Register record(s) document debarments, fraud findings, settlements, or sanctions linked to this entity.`,
    detail: `Federal Register publications are legally binding official government records. Debarments, suspensions, and False Claims Act settlements are formal legal findings. This is the highest-credibility evidence category — sourced directly from federalregister.gov.`,
    evidence,
  };
}

// ─────────────────────────────────────────
// RISK FACTOR 7 — Statistical outlier
// ─────────────────────────────────────────
function analyzeStatisticalOutlier(
  awards: Award[],
  peerStats: { avgAmount: number; medianAmount: number; totalPeers: number } | null
): RiskFactor | null {
  if (!peerStats || peerStats.totalPeers < 5) return null;
  const total   = awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const ratio   = peerStats.avgAmount > 0 ? total / peerStats.avgAmount : 0;
  if (ratio < 3) return null;

  const evidence: Evidence[] = [{
    id:   'stat-outlier',
    type: 'pattern' as const,
    title:       'Statistical Spending Outlier',
    description: `This entity received ${fmt(total)} — ${ratio.toFixed(1)}× the peer-group average of ${fmt(peerStats.avgAmount)} across ${peerStats.totalPeers} comparable recipients. Median peer spend: ${fmt(peerStats.medianAmount)}.`,
    sourceUrl:   'https://www.usaspending.gov',
    sourceLabel: 'USASpending.gov — Peer-Group Statistical Analysis',
    severity:    ratio >= 10 ? 'critical' : ratio >= 5 ? 'high' : 'medium',
    confidence:  85,
    sources:     ['USASpending.gov (peer analysis)'],
  }];

  const score = Math.min(20, ratio * 1.5);
  return {
    name: 'Statistically Anomalous Spending Level',
    score, weight: 0.15,
    description: `Awarded ${ratio.toFixed(1)}× more than the average comparable recipient — a statistically significant outlier.`,
    detail: `Cross-referencing this entity's total awards against ${peerStats.totalPeers} peer-group recipients reveals an extreme spending concentration. Statistical outliers of this magnitude are a recognised indicator of favouritism in procurement research literature.`,
    evidence,
  };
}

// ─────────────────────────────────────────
// CROSS-REFERENCING ENGINE
// ─────────────────────────────────────────
function crossReferenceFindings(factors: RiskFactor[]): RiskFactor[] {
  // Boost confidence on risk factors corroborated by multiple data sources
  return factors.map(f => {
    const sourceSet = new Set(f.evidence.flatMap(e => e.sources ?? []));
    const corroborated = sourceSet.size > 1;
    if (corroborated) {
      return {
        ...f,
        description: `[${sourceSet.size} sources confirm] ` + f.description,
        evidence: f.evidence.map(e => ({
          ...e,
          confidence: Math.min(99, (e.confidence ?? 80) + 5),
        })),
      };
    }
    return f;
  });
}

// ─────────────────────────────────────────
// RESPONSIBLE PARTIES
// ─────────────────────────────────────────
function extractResponsibleParties(awards: Award[], fedRegDocs: FedRegDocument[]): ResponsibleParty[] {
  const parties: ResponsibleParty[] = [];

  const agencyMap: Record<string, { count: number; amount: number }> = {};
  const subMap:    Record<string, { count: number; amount: number; parent: string }> = {};
  for (const a of awards) {
    const ag  = a['Awarding Agency']     || 'Unknown';
    const sub = a['Awarding Sub Agency'] || ag;
    if (!agencyMap[ag])        agencyMap[ag]        = { count: 0, amount: 0 };
    if (!subMap[sub])          subMap[sub]          = { count: 0, amount: 0, parent: ag };
    agencyMap[ag].count++;  agencyMap[ag].amount  += a['Award Amount'] || 0;
    subMap[sub].count++;    subMap[sub].amount    += a['Award Amount'] || 0;
  }

  for (const [name, s] of Object.entries(agencyMap).sort((a,b) => b[1].amount - a[1].amount).slice(0, 3)) {
    parties.push({
      name:         `${name} Leadership`,
      role:         'Awarding Authority',
      organization: name,
      relevance:    `Authorised ${s.count} awards totalling ${fmt(s.amount)}. Agency heads and Senior Procurement Executives are legally accountable under 41 U.S.C. § 1705 for all contracts issued under their authority.`,
    });
  }
  for (const [name, s] of Object.entries(subMap).sort((a,b) => b[1].amount - a[1].amount).slice(0, 2)) {
    if (name !== s.parent) {
      parties.push({
        name:         `${name} Contracting Office`,
        role:         'Contracting Officer Authority',
        organization: s.parent,
        relevance:    `Responsible for ${s.count} contracts totalling ${fmt(s.amount)}. Contracting Officers bear personal legal accountability under FAR 1.602-1 and can be held individually liable for unauthorized commitments.`,
      });
    }
  }

  // Pull agency names from Federal Register debarment/sanction documents
  for (const doc of fedRegDocs.slice(0, 2)) {
    const agencies = (doc.agencies || []).map(a => a.name).filter(Boolean);
    for (const ag of agencies) {
      if (!parties.find(p => p.organization === ag)) {
        parties.push({
          name:         `${ag} (Federal Register Action)`,
          role:         'Regulatory / Oversight Authority',
          organization: ag,
          relevance:    `Published regulatory action "${doc.title.slice(0,80)}" on ${doc.publication_date}. Source: federalregister.gov document ${doc.document_number}.`,
        });
      }
    }
  }

  return parties;
}

// ─────────────────────────────────────────
// SUMMARY GENERATOR
// ─────────────────────────────────────────
function buildSummary(
  name: string, score: number, level: string,
  factors: RiskFactor[], total: number, count: number,
  sources: string[]
): string {
  const top = [...factors].sort((a, b) => b.score - a.score)[0];
  const concern = top ? top.name.toLowerCase() : 'spending patterns';
  const sourceList = [...new Set(sources)].join(', ');
  const verdict =
    level === 'CRITICAL' || level === 'HIGH'
      ? 'Significant anomalies detected — findings warrant review by Inspector General or oversight committee.'
      : level === 'MODERATE'
      ? 'Some irregular patterns detected. Recommend monitoring and further scrutiny of flagged contracts.'
      : 'No major red flags found in the current data window.';
  return `Cross-source analysis of ${count} federal awards (${fmt(total)}) associated with "${name}" across ${sourceList} yielded a risk score of ${score}/100 (${level}). Primary concern: ${concern}. ${verdict}`;
}

// ─────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────
export function analyzeEntity(
  entityName: string,
  entityType: 'recipient' | 'agency' | 'person',
  awards: Award[],
  fedRegDocs: FedRegDocument[] = [],
  peerStats: { avgAmount: number; medianAmount: number; totalPeers: number } | null = null
): CorruptionAnalysis {
  const rawFactors: (RiskFactor | null)[] = [
    analyzeCompetition(awards),
    entityType !== 'recipient' ? analyzeConcentration(awards) : null,
    analyzeEmergencyJustifications(awards),
    analyzeRiskyContractTypes(awards),
    analyzeSingleBid(awards),
    analyzeRegulatoryRecords(fedRegDocs),
    analyzeStatisticalOutlier(awards, peerStats),
  ];

  const factors = crossReferenceFindings(rawFactors.filter((f): f is RiskFactor => f !== null));

  const overallScore = Math.min(100, Math.round(factors.reduce((s, f) => s + f.score, 0)));
  const totalAmount  = awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const topContracts = [...awards].sort((a, b) => (b['Award Amount'] || 0) - (a['Award Amount'] || 0)).slice(0, 10);
  const responsibleParties = extractResponsibleParties(awards, fedRegDocs);

  const sources = ['USASpending.gov'];
  if (fedRegDocs.length) sources.push('FederalRegister.gov');
  if (peerStats)         sources.push('Peer-Group Statistical Analysis');

  return {
    entityName,
    entityType,
    overallScore,
    riskLevel: getRiskLevel(overallScore),
    riskFactors: factors,
    responsibleParties,
    totalAwards:  awards.length,
    totalAmount,
    topContracts,
    summary:     buildSummary(entityName, overallScore, getRiskLevel(overallScore), factors, totalAmount, awards.length, sources),
    dataSource:  sources.join(' · '),
    lastUpdated: new Date().toISOString(),
  };
}
