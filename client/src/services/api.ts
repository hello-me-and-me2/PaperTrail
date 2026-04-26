import axios from 'axios';
import { CorruptionAnalysis, SearchResponse } from '../types';

const client = axios.create({ baseURL: '/api', timeout: 45000 });

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
