import {
  Award,
  CorruptionAnalysis,
  Evidence,
  ResponsibleParty,
  RiskFactor,
} from '../types';

const USA_SPENDING_BASE = 'https://www.usaspending.gov';

function buildAwardUrl(awardId: string): string {
  return `${USA_SPENDING_BASE}/award/${awardId}`;
}

function formatMoney(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function getRiskLevel(score: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

function analyzeCompetition(awards: Award[]): RiskFactor | null {
  const contracts = awards.filter((a) =>
    ['A', 'B', 'C', 'D'].includes(a['Award Type'])
  );
  if (contracts.length === 0) return null;

  const nonCompeted = contracts.filter((a) => {
    const ec = (a['Extent Competed'] || '').toUpperCase();
    return (
      ec.includes('NOT COMPETED') ||
      ec.includes('NOT AVAILABLE') ||
      ec.includes('ONLY ONE SOURCE')
    );
  });

  if (nonCompeted.length === 0) return null;

  const nonCompetedAmount = nonCompeted.reduce(
    (s, a) => s + (a['Award Amount'] || 0),
    0
  );
  const totalAmount = contracts.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const percentage = totalAmount > 0 ? (nonCompetedAmount / totalAmount) * 100 : 0;

  const evidence: Evidence[] = nonCompeted.slice(0, 5).map((a) => ({
    id: a['Award ID'],
    type: 'contract',
    title: `No-Bid Contract: ${a['Award ID']}`,
    description: `${formatMoney(a['Award Amount'])} awarded to ${a['Recipient Name']} by ${a['Awarding Agency']} with no competitive bidding (${a['Extent Competed'] || 'N/A'}).`,
    amount: a['Award Amount'],
    date: a['Start Date'],
    sourceUrl: buildAwardUrl(a['Award ID']),
    sourceLabel: 'USASpending.gov',
    severity: a['Award Amount'] >= 10_000_000 ? 'critical' : 'high',
  }));

  const score = Math.min(40, 10 + (percentage / 100) * 30);

  return {
    name: 'Non-Competitive Awards',
    score,
    weight: 0.35,
    description: `${nonCompeted.length} of ${contracts.length} contracts (${percentage.toFixed(0)}% by value) were awarded without competitive bidding.`,
    detail: `Sole-source and no-bid contracts bypass market competition, enabling inflated pricing and favoritism. ${formatMoney(nonCompetedAmount)} was awarded non-competitively out of ${formatMoney(totalAmount)} total.`,
    evidence,
  };
}

function analyzeVendorConcentration(awards: Award[]): RiskFactor | null {
  if (awards.length < 5) return null;

  const recipientMap: Record<string, { count: number; amount: number }> = {};
  for (const a of awards) {
    const name = a['Recipient Name'] || 'Unknown';
    if (!recipientMap[name]) recipientMap[name] = { count: 0, amount: 0 };
    recipientMap[name].count += 1;
    recipientMap[name].amount += a['Award Amount'] || 0;
  }

  const sorted = Object.entries(recipientMap).sort((a, b) => b[1].amount - a[1].amount);
  if (sorted.length < 2) return null;

  const totalAmount = awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const topVendor = sorted[0];
  const topPercentage = totalAmount > 0 ? (topVendor[1].amount / totalAmount) * 100 : 0;

  if (topPercentage < 50) return null;

  const evidence: Evidence[] = awards
    .filter((a) => a['Recipient Name'] === topVendor[0])
    .slice(0, 4)
    .map((a) => ({
      id: a['Award ID'],
      type: 'pattern' as const,
      title: `Concentrated Award: ${a['Award ID']}`,
      description: `${formatMoney(a['Award Amount'])} awarded to ${a['Recipient Name']} by ${a['Awarding Agency']}.`,
      amount: a['Award Amount'],
      date: a['Start Date'],
      sourceUrl: buildAwardUrl(a['Award ID']),
      sourceLabel: 'USASpending.gov',
      severity: topPercentage >= 80 ? 'critical' : 'high',
    }));

  const score = Math.min(30, (topPercentage / 100) * 30);

  return {
    name: 'Award Concentration',
    score,
    weight: 0.25,
    description: `${topVendor[0]} received ${topPercentage.toFixed(0)}% of all spending (${formatMoney(topVendor[1].amount)}).`,
    detail: `Excessive concentration of contracts with a single vendor reduces competitive market dynamics and creates dependency relationships that can enable corruption. Industry best practice recommends no single vendor exceed 30-40% of agency spending.`,
    evidence,
  };
}

function analyzeLargeAnomalies(awards: Award[]): RiskFactor | null {
  const megaContracts = awards.filter(
    (a) => (a['Award Amount'] || 0) >= 100_000_000
  );
  if (megaContracts.length === 0) return null;

  const singleSourceMega = megaContracts.filter((a) => {
    const offers = a['Number of Offers Received'];
    const ec = (a['Extent Competed'] || '').toUpperCase();
    return offers === 1 || offers === 0 || ec.includes('NOT COMPETED');
  });

  if (singleSourceMega.length === 0 && megaContracts.length < 3) return null;

  const evidence: Evidence[] = megaContracts.slice(0, 5).map((a) => ({
    id: a['Award ID'],
    type: 'contract' as const,
    title: `High-Value Award: ${a['Award ID']}`,
    description: `${formatMoney(a['Award Amount'])} awarded to ${a['Recipient Name']} by ${a['Awarding Agency']}. Offers received: ${a['Number of Offers Received'] ?? 'N/A'}.`,
    amount: a['Award Amount'],
    date: a['Start Date'],
    sourceUrl: buildAwardUrl(a['Award ID']),
    sourceLabel: 'USASpending.gov',
    severity: singleSourceMega.includes(a) ? 'critical' : 'medium',
  }));

  const score = Math.min(25, 5 + singleSourceMega.length * 8);

  return {
    name: 'Anomalous High-Value Awards',
    score,
    weight: 0.2,
    description: `${megaContracts.length} contract(s) over $100M detected; ${singleSourceMega.length} were awarded with no competition.`,
    detail: `Large single-source contracts represent significant risk of waste and fraud. Federal Acquisition Regulations require enhanced oversight for awards over $25M, and GAO audits frequently flag these for mismanagement.`,
    evidence,
  };
}

function analyzeSingleOfferContracts(awards: Award[]): RiskFactor | null {
  const contracts = awards.filter((a) =>
    ['A', 'B', 'C', 'D'].includes(a['Award Type'])
  );
  const singleOffer = contracts.filter(
    (a) =>
      (a['Number of Offers Received'] === 1 ||
        a['Number of Offers Received'] === 0) &&
      (a['Award Amount'] || 0) >= 500_000
  );
  if (singleOffer.length < 2) return null;

  const singleOfferAmount = singleOffer.reduce(
    (s, a) => s + (a['Award Amount'] || 0),
    0
  );

  const evidence: Evidence[] = singleOffer.slice(0, 4).map((a) => ({
    id: a['Award ID'],
    type: 'contract' as const,
    title: `Single-Bid Contract: ${a['Award ID']}`,
    description: `${formatMoney(a['Award Amount'])} contract with only 1 offer received. Awarded by ${a['Awarding Agency']} to ${a['Recipient Name']}.`,
    amount: a['Award Amount'],
    date: a['Start Date'],
    sourceUrl: buildAwardUrl(a['Award ID']),
    sourceLabel: 'USASpending.gov',
    severity: 'high',
  }));

  const score = Math.min(20, singleOffer.length * 3);

  return {
    name: 'Single-Bid Contracts',
    score,
    weight: 0.2,
    description: `${singleOffer.length} contracts received only one offer totaling ${formatMoney(singleOfferAmount)}.`,
    detail: `Contracts with a single bidder suggest the solicitation may have been written to favor a predetermined vendor, effective pricing competition was absent, or barriers existed that discouraged other vendors from participating.`,
    evidence,
  };
}

function extractResponsibleParties(awards: Award[]): ResponsibleParty[] {
  const agencyMap: Record<string, { count: number; amount: number }> = {};
  const subAgencyMap: Record<string, { count: number; amount: number; parent: string }> = {};

  for (const a of awards) {
    const agency = a['Awarding Agency'] || 'Unknown Agency';
    const subAgency = a['Awarding Sub Agency'] || agency;
    if (!agencyMap[agency]) agencyMap[agency] = { count: 0, amount: 0 };
    agencyMap[agency].count += 1;
    agencyMap[agency].amount += a['Award Amount'] || 0;
    if (!subAgencyMap[subAgency]) subAgencyMap[subAgency] = { count: 0, amount: 0, parent: agency };
    subAgencyMap[subAgency].count += 1;
    subAgencyMap[subAgency].amount += a['Award Amount'] || 0;
  }

  const parties: ResponsibleParty[] = [];

  const topAgencies = Object.entries(agencyMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 3);

  for (const [name, stats] of topAgencies) {
    parties.push({
      name: `${name} Leadership`,
      role: 'Awarding Authority',
      organization: name,
      relevance: `Authorized ${stats.count} awards totaling ${formatMoney(stats.amount)}. Agency heads and acquisition officials hold oversight responsibility for all contracts issued under their authority.`,
    });
  }

  const topSubAgencies = Object.entries(subAgencyMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 2);

  for (const [name, stats] of topSubAgencies) {
    if (name !== stats.parent) {
      parties.push({
        name: `${name} Contracting Office`,
        role: 'Contracting Officer Authority',
        organization: stats.parent,
        relevance: `Sub-agency responsible for ${stats.count} contracts totaling ${formatMoney(stats.amount)}. Contracting Officers at this office bear legal accountability under FAR Part 1.602.`,
      });
    }
  }

  return parties;
}

export function analyzeEntity(
  entityName: string,
  entityType: 'recipient' | 'agency' | 'person',
  awards: Award[]
): CorruptionAnalysis {
  const riskFactors: RiskFactor[] = [];

  const competition = analyzeCompetition(awards);
  if (competition) riskFactors.push(competition);

  if (entityType === 'agency' || entityType === 'person') {
    const concentration = analyzeVendorConcentration(awards);
    if (concentration) riskFactors.push(concentration);
  }

  const anomalies = analyzeLargeAnomalies(awards);
  if (anomalies) riskFactors.push(anomalies);

  const singleBid = analyzeSingleOfferContracts(awards);
  if (singleBid) riskFactors.push(singleBid);

  const rawScore = riskFactors.reduce((s, f) => s + f.score, 0);
  const overallScore = Math.min(100, Math.round(rawScore));

  const totalAmount = awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
  const topContracts = [...awards]
    .sort((a, b) => (b['Award Amount'] || 0) - (a['Award Amount'] || 0))
    .slice(0, 10);

  const responsibleParties =
    entityType !== 'recipient'
      ? extractResponsibleParties(awards)
      : [];

  const riskLevel = getRiskLevel(overallScore);

  const summary = buildSummary(entityName, overallScore, riskLevel, riskFactors, totalAmount, awards.length);

  return {
    entityName,
    entityType,
    overallScore,
    riskLevel,
    riskFactors,
    responsibleParties,
    totalAwards: awards.length,
    totalAmount,
    topContracts,
    summary,
    dataSource: 'USASpending.gov — Federal Government Open Data',
    lastUpdated: new Date().toISOString(),
  };
}

function buildSummary(
  name: string,
  score: number,
  level: string,
  factors: RiskFactor[],
  total: number,
  count: number
): string {
  const topFactor = factors.sort((a, b) => b.score - a.score)[0];
  const concern = topFactor ? topFactor.name.toLowerCase() : 'spending patterns';
  return `Analysis of ${count} federal awards totaling ${formatMoney(total)} associated with "${name}" yielded a risk score of ${score}/100 (${level}). The primary concern is ${concern}. ${level === 'CRITICAL' || level === 'HIGH' ? 'Significant red flags warrant further investigation by oversight authorities.' : level === 'MODERATE' ? 'Some concerning patterns detected; recommend monitoring.' : 'No major red flags detected in current data window.'}`;
}
