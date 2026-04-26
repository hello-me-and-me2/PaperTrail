import axios from 'axios';
import { Award, SearchResult, SpendingOverTime } from '../types';

const BASE_URL = 'https://api.usaspending.gov/api/v2';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const AWARD_FIELDS = [
  'Award ID',
  'Recipient Name',
  'Start Date',
  'End Date',
  'Award Amount',
  'Awarding Agency',
  'Awarding Sub Agency',
  'Award Type',
  'Funding Agency',
  'Description',
  'Place of Performance State Code',
  'Number of Offers Received',
  'Extent Competed',
];

export async function searchAwardsByKeyword(
  query: string,
  page = 1,
  limit = 25
): Promise<SearchResult> {
  const endDate = new Date().toISOString().split('T')[0];
  const response = await api.post('/search/spending_by_award/', {
    filters: {
      keywords: [query],
      award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],
      time_period: [{ start_date: '2018-01-01', end_date: endDate }],
    },
    fields: AWARD_FIELDS,
    page,
    limit,
    sort: 'Award Amount',
    order: 'desc',
    subawards: false,
  });
  return response.data;
}

export async function searchAwardsByRecipient(
  recipientName: string,
  page = 1,
  limit = 100
): Promise<SearchResult> {
  const endDate = new Date().toISOString().split('T')[0];
  const response = await api.post('/search/spending_by_award/', {
    filters: {
      recipient_search_text: [recipientName],
      award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],
      time_period: [{ start_date: '2018-01-01', end_date: endDate }],
    },
    fields: AWARD_FIELDS,
    page,
    limit,
    sort: 'Award Amount',
    order: 'desc',
    subawards: false,
  });
  return response.data;
}

export async function searchAwardsByAgency(
  agencyName: string,
  page = 1,
  limit = 100
): Promise<SearchResult> {
  const endDate = new Date().toISOString().split('T')[0];
  const response = await api.post('/search/spending_by_award/', {
    filters: {
      agencies: [{ type: 'awarding', tier: 'toptier', name: agencyName }],
      award_type_codes: ['A', 'B', 'C', 'D'],
      time_period: [{ start_date: '2018-01-01', end_date: endDate }],
    },
    fields: AWARD_FIELDS,
    page,
    limit,
    sort: 'Award Amount',
    order: 'desc',
    subawards: false,
  });
  return response.data;
}

export async function getSpendingOverTime(
  filters: Record<string, unknown>
): Promise<SpendingOverTime[]> {
  const response = await api.post('/search/spending_over_time/', {
    group: 'fiscal_year',
    filters,
  });
  const results: SpendingOverTime[] = (response.data.results || []).map(
    (r: { time_period: { fiscal_year: string }; aggregated_amount: number }) => ({
      fiscalYear: r.time_period.fiscal_year,
      amount: r.aggregated_amount,
      awardCount: 0,
    })
  );
  return results.sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear));
}

export async function autocompleteRecipients(query: string): Promise<{ results: { recipient_name: string; recipient_id: string }[] }> {
  const response = await api.get('/autocomplete/recipient/', {
    params: { search_text: query, limit: 8 },
  });
  return response.data;
}

export async function getRecipientProfile(recipientId: string): Promise<Record<string, unknown>> {
  const response = await api.get(`/recipient/${recipientId}/`);
  return response.data;
}

export async function getTopRecipients(
  agencyFilter?: string
): Promise<{ results: { recipient_name: string; recipient_id: string; amount: number }[] }> {
  const endDate = new Date().toISOString().split('T')[0];
  const filters: Record<string, unknown> = {
    award_type_codes: ['A', 'B', 'C', 'D'],
    time_period: [{ start_date: '2022-01-01', end_date: endDate }],
  };
  if (agencyFilter) {
    filters.agencies = [{ type: 'awarding', tier: 'toptier', name: agencyFilter }];
  }
  const response = await api.post('/search/spending_by_recipient/', {
    filters,
    category: 'recipient',
    limit: 10,
    page: 1,
  });
  return response.data;
}

export async function getAwardDetail(awardId: string): Promise<Record<string, unknown>> {
  const response = await api.get(`/awards/${awardId}/`);
  return response.data;
}

export async function getSoleSourceAwards(
  query: string,
  limit = 50
): Promise<Award[]> {
  const endDate = new Date().toISOString().split('T')[0];
  const response = await api.post('/search/spending_by_award/', {
    filters: {
      keywords: [query],
      award_type_codes: ['A', 'B', 'C', 'D'],
      extent_competed: ['NOT COMPETED'],
      time_period: [{ start_date: '2018-01-01', end_date: endDate }],
    },
    fields: AWARD_FIELDS,
    page: 1,
    limit,
    sort: 'Award Amount',
    order: 'desc',
    subawards: false,
  });
  return response.data.results || [];
}
