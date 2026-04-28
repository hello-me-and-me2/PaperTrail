export interface Award {
  'Award ID': string;
  'Recipient Name': string;
  'Start Date': string;
  'End Date': string;
  'Award Amount': number;
  'Awarding Agency': string;
  'Awarding Sub Agency': string;
  'Award Type': string;
  'Funding Agency': string;
  Description: string;
  'Extent Competed'?: string;
  'Number of Offers Received'?: number;
  'Place of Performance State Code'?: string;
  'Type of Contract Pricing'?: string;
  internal_id?: string;
}

export interface Evidence {
  id: string;
  type: 'contract' | 'grant' | 'pattern' | 'public_record';
  title: string;
  description: string;
  amount?: number;
  date?: string;
  sourceUrl: string;
  sourceLabel: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence?: number;   // 0-100 — how certain is this finding
  sources?: string[];    // which data sources confirm this
}

export interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  detail: string;
  evidence: Evidence[];
}

export interface ResponsibleParty {
  name: string;
  role: string;
  organization: string;
  period?: string;
  relevance: string;
}

export interface CorruptionAnalysis {
  entityName: string;
  entityType: 'recipient' | 'agency' | 'person';
  overallScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskFactors: RiskFactor[];
  responsibleParties: ResponsibleParty[];
  totalAwards: number;
  totalAmount: number;
  topContracts: Award[];
  summary: string;
  dataSource: string;
  lastUpdated: string;
}

export interface SearchResponse {
  query: string;
  recipients: RecipientSummary[];
  agencies: AgencySummary[];
  contracts: Award[];
  totalResults: number;
}

export interface RecipientSummary {
  id: string;
  name: string;
  location: string;
  totalAmount: number;
  awardCount: number;
  topAgency: string;
  riskScore?: number;
}

export interface AgencySummary {
  id: string;
  name: string;
  totalAmount: number;
  awardCount: number;
  topRecipient: string;
}

export interface SpendingOverTime {
  fiscalYear: string;
  amount: number;
  awardCount: number;
}
