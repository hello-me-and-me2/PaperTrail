import axios from 'axios';
import { CorruptionAnalysis, OrgSuggestion, OrgSurvey, OrgDataHit, SearchResponse } from '../types';

const client = axios.create({ baseURL: '/api', timeout: 45000 });

// Authenticated client — reads token from localStorage automatically
const authClient = axios.create({ baseURL: '/api', timeout: 30000 });
authClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('pt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function search(query: string): Promise<SearchResponse> {
  const { data } = await client.get('/search', { params: { q: query } });
  return data;
}

export async function analyzeRecipient(name: string, org?: string): Promise<CorruptionAnalysis> {
  const { data } = await authClient.get(`/analysis/recipient/${encodeURIComponent(name)}`, {
    params: org ? { org } : {},
  });
  return data;
}

export async function analyzeAgency(name: string, org?: string): Promise<CorruptionAnalysis> {
  const { data } = await authClient.get(`/analysis/agency/${encodeURIComponent(name)}`, {
    params: org ? { org } : {},
  });
  return data;
}

export async function analyzePerson(name: string, org?: string): Promise<CorruptionAnalysis> {
  const { data } = await authClient.get(`/analysis/person/${encodeURIComponent(name)}`, {
    params: org ? { org } : {},
  });
  return data;
}

export async function searchOrgs(query: string): Promise<OrgSuggestion[]> {
  const { data } = await authClient.get('/org/search', { params: { q: query } });
  return data;
}

export async function uploadOrgFile(file: File): Promise<{ id: number; originalName: string; fileType: string; fileSize: number }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await authClient.post('/org/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
}

export async function listOrgFiles(): Promise<{ id: number; original_name: string; file_type: string; file_size: number; uploaded_at: string }[]> {
  const { data } = await authClient.get('/org/files');
  return data;
}

export async function deleteOrgFile(id: number): Promise<void> {
  await authClient.delete(`/org/files/${id}`);
}

export async function saveSurvey(survey: OrgSurvey): Promise<void> {
  await authClient.post('/auth/survey', survey);
}

export async function searchOrgData(q: string): Promise<OrgDataHit[]> {
  const { data } = await authClient.get('/org/search-data', { params: { q } });
  return data;
}
