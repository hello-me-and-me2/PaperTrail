import axios from 'axios';

const api = axios.create({ baseURL: 'https://www.federalregister.gov/api/v1', timeout: 15000 });

export interface FedRegDocument {
  document_number: string;
  title: string;
  abstract: string;
  publication_date: string;
  html_url: string;
  type: string;
  agencies: { name: string }[];
}

export async function searchFederalRegister(query: string, limit = 8): Promise<FedRegDocument[]> {
  try {
    const { data } = await api.get('/documents.json', {
      params: {
        'conditions[term]': query,
        'fields[]': ['title', 'abstract', 'document_number', 'publication_date', 'html_url', 'type', 'agencies'],
        per_page: limit,
        order: 'relevance',
      },
    });
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function searchDebarments(query: string, limit = 5): Promise<FedRegDocument[]> {
  try {
    const { data } = await api.get('/documents.json', {
      params: {
        'conditions[term]': `"${query}" debarment OR suspension OR exclusion OR settlement OR fraud`,
        'fields[]': ['title', 'abstract', 'document_number', 'publication_date', 'html_url', 'type', 'agencies'],
        per_page: limit,
        order: 'relevance',
      },
    });
    return data.results ?? [];
  } catch {
    return [];
  }
}
