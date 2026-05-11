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
  confidence?: number;
  sources?: string[];
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

export interface SpendingOverTime {
  fiscalYear: string;
  amount: number;
  awardCount: number;
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
  spendingOverTime?: SpendingOverTime[];
  sourcesQueried?: string[];
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

export interface WebSearchSuggestion {
  name: string;
  industry: string;
  description: string;
  type: 'web';
}

export interface SearchResponse {
  query: string;
  recipients: RecipientSummary[];
  agencies: AgencySummary[];
  contracts: Award[];
  totalResults: number;
  webResults?: WebSearchSuggestion[];
}

export type SearchType = 'all' | 'recipient' | 'agency' | 'person';

export interface OrgSuggestion {
  name: string;
  type: string;
  industry: string;
  description: string;
  source: string;
}

export interface OrgSurvey {
  employeeCount?: string;
  annualBudget?: string;
  geographicScope?: string;
  industry?: string;
  vendorCount?: string;
  riskAreas?: string[];
  regulatoryFrameworks?: string[];
  auditTeam?: string;
  dataSystems?: string[];
  paymentTracking?: string;
}

export interface OrgDataHit {
  name: string;
  detail: string;
  source: string;
}

export interface DataRecommendation {
  id: string;
  label: string;
  hint: string;
  priority: 'high' | 'medium' | 'low';
  fileTypes: string;
}
