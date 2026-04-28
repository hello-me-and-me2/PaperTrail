import axios from 'axios';

const api = axios.create({ baseURL: 'https://api.usaspending.gov/api/v2', timeout: 30000 });

// ── existing exports kept, enhanced below ──

export interface RecipientProfile {
  name: string;
  duns: string;
  uei: string;
  location: {
    address_line1: string;
    city_name: string;
    state_code: string;
    zip5: string;
    country_name: string;
  };
  business_types: string[];
  total_transaction_amount: number;
  total_transactions: number;
}

export interface SubAward {
  id: string;
  description: string;
  action_date: string;
  amount: number;
  recipient: { recipient_name: string; location: { country_name: string } };
}

/** Fetch detailed recipient profile by UEI or name slug */
export async function fetchRecipientProfile(recipientName: string): Promise<RecipientProfile | null> {
  try {
    const search = await api.get('/autocomplete/recipient/', { params: { search_text: recipientName, limit: 1 } });
    const results = search.data?.results ?? [];
    if (!results.length) return null;
    const id = results[0].recipient_id;
    if (!id) return null;
    const { data } = await api.get(`/recipient/${id}/`);
    return data as RecipientProfile;
  } catch {
    return null;
  }
}

/** Fetch peer-group summary statistics for the same NAICS codes the recipient uses */
export async function fetchPeerStats(
  naicsCodes: string[],
  startDate: string
): Promise<{ avgAmount: number; medianAmount: number; totalPeers: number } | null> {
  if (!naicsCodes.length) return null;
  try {
    const { data } = await api.post('/search/spending_by_recipient/', {
      filters: {
        naics_codes: naicsCodes,
        award_type_codes: ['A', 'B', 'C', 'D'],
        time_period: [{ start_date: startDate, end_date: new Date().toISOString().split('T')[0] }],
      },
      category: 'recipient',
      limit: 100,
      page: 1,
    });
    const amounts: number[] = (data.results ?? []).map((r: { amount: number }) => r.amount);
    if (!amounts.length) return null;
    amounts.sort((a, b) => a - b);
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const median = amounts[Math.floor(amounts.length / 2)];
    return { avgAmount: avg, medianAmount: median, totalPeers: amounts.length };
  } catch {
    return null;
  }
}

/** Fetch sub-award data for a prime award */
export async function fetchSubAwards(awardId: string, limit = 10): Promise<SubAward[]> {
  try {
    const { data } = await api.post('/search/spending_by_award/', {
      filters: {
        award_type_codes: ['A', 'B', 'C', 'D'],
        time_period: [{ start_date: '2018-01-01', end_date: new Date().toISOString().split('T')[0] }],
        award_ids: [awardId],
      },
      fields: ['Sub-Award ID', 'Sub-Awardee Name', 'Sub-Award Date', 'Sub-Award Amount', 'recipient'],
      page: 1,
      limit,
      subawards: true,
    });
    return data.results ?? [];
  } catch {
    return [];
  }
}

/** Look up contract pricing type and competition extent for a specific award */
export async function fetchAwardExtendedDetails(awardId: string): Promise<{
  typeOfContractPricing?: string;
  solicitationProcedures?: string;
  extentCompeted?: string;
  numberOfOffers?: number;
  emergencyAcquisition?: boolean;
  reasonNotCompeted?: string;
  totalModifications?: number;
  baseAndAllOptionsValue?: number;
} | null> {
  try {
    const { data } = await api.get(`/awards/${encodeURIComponent(awardId)}/`);
    const c = data.contract_data ?? {};
    return {
      typeOfContractPricing: c.type_of_contract_pricing,
      solicitationProcedures: c.solicitation_procedures,
      extentCompeted: c.extent_competed,
      numberOfOffers: c.number_of_offers_received,
      emergencyAcquisition:
        (c.solicitation_procedures || '').toUpperCase().includes('URGENCY') ||
        (c.other_than_full_and_open_competition || '').toUpperCase().includes('URGENCY'),
      reasonNotCompeted: c.other_than_full_and_open_competition,
      totalModifications: c.number_of_actions,
      baseAndAllOptionsValue: c.base_and_all_options_value,
    };
  } catch {
    return null;
  }
}

const AWARD_FIELDS = [
  'Award ID', 'Recipient Name', 'Start Date', 'End Date', 'Award Amount',
  'Awarding Agency', 'Awarding Sub Agency', 'Award Type', 'Funding Agency',
  'Description', 'Place of Performance State Code', 'Number of Offers Received',
  'Extent Competed', 'Type of Contract Pricing',
];

export async function searchAwardsByKeyword(query: string, page = 1, limit = 25) {
  const endDate = new Date().toISOString().split('T')[0];
  const { data } = await api.post('/search/spending_by_award/', {
    filters: {
      keywords: [query],
      award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],
      time_period: [{ start_date: '2018-01-01', end_date: endDate }],
    },
    fields: AWARD_FIELDS,
    page, limit, sort: 'Award Amount', order: 'desc', subawards: false,
  });
  return data;
}

export async function searchAwardsByRecipient(recipientName: string, page = 1, limit = 100) {
  const endDate = new Date().toISOString().split('T')[0];
  const { data } = await api.post('/search/spending_by_award/', {
    filters: {
      recipient_search_text: [recipientName],
      award_type_codes: ['A', 'B', 'C', 'D', '02', '03', '04', '05'],
      time_period: [{ start_date: '2018-01-01', end_date: endDate }],
    },
    fields: AWARD_FIELDS,
    page, limit, sort: 'Award Amount', order: 'desc', subawards: false,
  });
  return data;
}

export async function searchAwardsByAgency(agencyName: string, page = 1, limit = 100) {
  const endDate = new Date().toISOString().split('T')[0];
  const { data } = await api.post('/search/spending_by_award/', {
    filters: {
      agencies: [{ type: 'awarding', tier: 'toptier', name: agencyName }],
      award_type_codes: ['A', 'B', 'C', 'D'],
      time_period: [{ start_date: '2018-01-01', end_date: endDate }],
    },
    fields: AWARD_FIELDS,
    page, limit, sort: 'Award Amount', order: 'desc', subawards: false,
  });
  return data;
}

export async function getSpendingOverTime(filters: Record<string, unknown>) {
  const { data } = await api.post('/search/spending_over_time/', {
    group: 'fiscal_year', filters,
  });
  return (data.results ?? [])
    .map((r: { time_period: { fiscal_year: string }; aggregated_amount: number }) => ({
      fiscalYear: r.time_period.fiscal_year,
      amount: r.aggregated_amount,
      awardCount: 0,
    }))
    .sort((a: { fiscalYear: string }, b: { fiscalYear: string }) => a.fiscalYear.localeCompare(b.fiscalYear));
}

export async function getSoleSourceAwards(query: string, limit = 50) {
  const endDate = new Date().toISOString().split('T')[0];
  const { data } = await api.post('/search/spending_by_award/', {
    filters: {
      keywords: [query],
      award_type_codes: ['A', 'B', 'C', 'D'],
      extent_competed: ['NOT COMPETED'],
      time_period: [{ start_date: '2018-01-01', end_date: endDate }],
    },
    fields: AWARD_FIELDS,
    page: 1, limit, sort: 'Award Amount', order: 'desc', subawards: false,
  });
  return data.results ?? [];
}

export async function autocompleteRecipients(query: string) {
  const { data } = await api.get('/autocomplete/recipient/', { params: { search_text: query, limit: 8 } });
  return data;
}
