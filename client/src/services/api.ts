import axios from 'axios';
import { CorruptionAnalysis, OrgSuggestion, OrgSurvey, OrgDataHit, CorruptionAlert, OrgConnection, ScheduledInvestigation } from '../types';

const authClient = axios.create({ baseURL: '/api', timeout: 30000 });
authClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('pt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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

// Alerts
export async function getAlerts(): Promise<CorruptionAlert[]> {
  const { data } = await authClient.get('/alerts');
  return data;
}
export async function getUnreadCount(): Promise<number> {
  const { data } = await authClient.get('/alerts/unread');
  return data.count;
}
export async function markAlertRead(id: number): Promise<void> {
  await authClient.patch(`/alerts/${id}/read`);
}
export async function markAllAlertsRead(): Promise<void> {
  await authClient.post('/alerts/read-all');
}

// Connections
export async function getConnections(): Promise<OrgConnection[]> {
  const { data } = await authClient.get('/connections');
  return data;
}
export async function addConnection(service: string, label?: string, credentials?: Record<string, string>): Promise<OrgConnection> {
  const { data } = await authClient.post('/connections', { service, label, credentials });
  return data;
}
export async function deleteConnection(id: number): Promise<void> {
  await authClient.delete(`/connections/${id}`);
}

// Push notifications
export async function getVapidPublicKey(): Promise<string> {
  const { data } = await authClient.get('/push/vapid-key');
  return data.publicKey;
}
export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  await authClient.post('/push/subscribe', {
    endpoint: sub.endpoint,
    keys: sub.keys,
  });
}
export async function removePushSubscription(endpoint: string): Promise<void> {
  await authClient.delete('/push/subscribe', { data: { endpoint } });
}

// Investigation schedules
export async function scheduleInvestigation(
  entities: { name: string; type: string }[],
  durationMs: number,
  label?: string,
): Promise<{ id: number; endsAt: string }> {
  const { data } = await authClient.post('/investigate/schedule', { entities, durationMs, label });
  return data;
}
export async function getInvestigationSchedules(): Promise<ScheduledInvestigation[]> {
  const { data } = await authClient.get('/investigate/schedule');
  return data;
}
export async function stopInvestigationSchedule(id: number): Promise<void> {
  await authClient.delete(`/investigate/schedule/${id}`);
}
