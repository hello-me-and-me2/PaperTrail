import axios from 'axios';
import { CorruptionAnalysis, OrgSuggestion, SearchResponse } from '../types';

const client = axios.create({ baseURL: '/api', timeout: 45000 });

// Authenticated client — reads token from localStorage automatically
const authClient = axios.create({ baseURL: '/api', timeout: 15000 });
authClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('pt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function search(query: string): Promise<SearchResponse> {
  const { data } = await client.get('/search', { params: { q: query } });
  return data;
}

export async function analyzeRecipient(name: string): Promise<CorruptionAnalysis> {
  const { data } = await client.get(`/analysis/recipient/${encodeURIComponent(name)}`);
  return data;
}

export async function analyzeAgency(name: string): Promise<CorruptionAnalysis> {
  const { data } = await client.get(`/analysis/agency/${encodeURIComponent(name)}`);
  return data;
}

export async function analyzePerson(name: string): Promise<CorruptionAnalysis> {
  const { data } = await client.get(`/analysis/person/${encodeURIComponent(name)}`);
  return data;
}

export async function searchOrgs(query: string): Promise<OrgSuggestion[]> {
  const { data } = await authClient.get('/org/search', { params: { q: query } });
  return data;
}
