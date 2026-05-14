import { useState, useRef, useCallback } from 'react';
import { CorruptionAnalysis, SpendingOverTime } from '../types';
import { scheduleInvestigation, stopInvestigationSchedule } from '../services/api';

export type EntityType = 'recipient' | 'agency' | 'person';

export interface InvestigationEntity {
  name: string;
  type: EntityType;
}

export interface EntityResult {
  name: string;
  type: EntityType;
  status: 'queued' | 'fetching' | 'complete' | 'error';
  depth: number;
  discoveredFrom?: string;
  reason?: string;
  analysis?: CorruptionAnalysis;
  spendingOverTime?: SpendingOverTime[];
  error?: string;
}

export interface FeedItem {
  id: string;
  timestamp: string;
  event: string;
  name: string;
  type?: EntityType;
  detail?: string;
  severity?: 'info' | 'success' | 'warning' | 'danger' | 'discovery';
}

export interface InvestigationSummary {
  totalAnalyzed: number;
  criticalCount: number;
  highCount: number;
  totalAmount: number;
  topRisk: { name: string; score: number; level: string }[];
}

export interface InvestigationState {
  status: 'idle' | 'running' | 'complete' | 'error';
  entities: EntityResult[];
  feed: FeedItem[];
  summary: InvestigationSummary | null;
  scheduleId: number | null;
  scheduleEndsAt: string | null;
}

function feedId() {
  return Math.random().toString(36).slice(2);
}

export function useInvestigation() {
  const [state, setState] = useState<InvestigationState>({
    status: 'idle',
    entities: [],
    feed: [],
    summary: null,
    scheduleId: null,
    scheduleEndsAt: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const addFeed = useCallback((item: Omit<FeedItem, 'id' | 'timestamp'>) => {
    setState((s) => ({
      ...s,
      feed: [{ ...item, id: feedId(), timestamp: new Date().toLocaleTimeString() }, ...s.feed],
    }));
  }, []);

  const start = useCallback(async (entities: InvestigationEntity[], durationMs = 0) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: 'running',
      entities: entities.map((e) => ({ ...e, status: 'queued', depth: 0 })),
      feed: [],
      summary: null,
      scheduleId: null,
      scheduleEndsAt: null,
    });

    // Save schedule server-side if duration is set
    if (durationMs > 0) {
      scheduleInvestigation(entities, durationMs)
        .then(({ id, endsAt }) => {
          setState((s) => ({ ...s, scheduleId: id, scheduleEndsAt: endsAt }));
        })
        .catch(() => {});
    }

    try {
      const token = localStorage.getItem('pt_token');
      const response = await fetch('/api/investigate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ entities }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to connect to investigation stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          } else if (line === '' && eventType) {
            try {
              const data = JSON.parse(dataStr);
              handleEvent(eventType, data);
            } catch { /* ignore parse errors */ }
            eventType = '';
            dataStr = '';
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setState((s) => ({ ...s, status: 'error' }));
    }

    function handleEvent(eventType: string, data: Record<string, unknown>) {
      switch (eventType) {
        case 'investigation_started':
          addFeed({ event: 'Investigation started', name: `${(data.totalQueued as number)} entities queued`, severity: 'info' });
          break;

        case 'entity_queued':
          setState((s) => {
            const exists = s.entities.find((e) => e.name === data.name && e.type === data.entityType);
            if (exists) return s;
            return {
              ...s,
              entities: [
                ...s.entities,
                {
                  name: data.name as string,
                  type: data.entityType as EntityType,
                  status: 'queued',
                  depth: data.depth as number,
                  discoveredFrom: data.discoveredFrom as string | undefined,
                  reason: data.reason as string | undefined,
                },
              ],
            };
          });
          addFeed({
            event: 'Discovered',
            name: data.name as string,
            type: data.entityType as EntityType,
            detail: data.reason as string,
            severity: 'discovery',
          });
          break;

        case 'entity_fetching':
          setState((s) => ({
            ...s,
            entities: s.entities.map((e) =>
              e.name === data.name && e.type === data.entityType ? { ...e, status: 'fetching' } : e
            ),
          }));
          addFeed({ event: 'Fetching data', name: data.name as string, type: data.entityType as EntityType, severity: 'info' });
          break;

        case 'entity_complete': {
          const analysis = data.analysis as CorruptionAnalysis;
          setState((s) => ({
            ...s,
            entities: s.entities.map((e) =>
              e.name === data.name && e.type === data.entityType
                ? { ...e, status: 'complete', analysis, spendingOverTime: data.spendingOverTime as SpendingOverTime[] }
                : e
            ),
          }));
          const level = analysis.riskLevel;
          addFeed({
            event: 'Analysis complete',
            name: data.name as string,
            type: data.entityType as EntityType,
            detail: `Score ${analysis.overallScore}/100 — ${level}`,
            severity: level === 'CRITICAL' ? 'danger' : level === 'HIGH' ? 'warning' : 'success',
          });
          break;
        }

        case 'entity_error':
          setState((s) => ({
            ...s,
            entities: s.entities.map((e) =>
              e.name === data.name && e.type === data.entityType
                ? { ...e, status: 'error', error: data.error as string }
                : e
            ),
          }));
          addFeed({ event: 'Error', name: data.name as string, detail: data.error as string, severity: 'danger' });
          break;

        case 'investigation_complete':
          setState((s) => ({ ...s, status: 'complete', summary: data as unknown as InvestigationSummary }));
          addFeed({ event: 'Investigation complete', name: `${data.totalAnalyzed} entities analyzed`, severity: 'success' });
          break;

        case 'done':
          setState((s) => ({ ...s, status: s.status === 'running' ? 'complete' : s.status }));
          break;
      }
    }
  }, [addFeed]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, status: 'idle' }));
  }, []);

  const cancelSchedule = useCallback(() => {
    setState((s) => {
      if (s.scheduleId) stopInvestigationSchedule(s.scheduleId).catch(() => {});
      return { ...s, scheduleId: null, scheduleEndsAt: null };
    });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: 'idle', entities: [], feed: [], summary: null, scheduleId: null, scheduleEndsAt: null });
  }, []);

  return { state, start, stop, cancelSchedule, reset };
}
