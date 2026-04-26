import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, Zap } from 'lucide-react';
import { Evidence } from '../types';

interface EvidencePanelProps {
  evidence: Evidence[];
  title?: string;
}

const severityConfig = {
  critical: {
    icon: Zap,
    cls: 'border-red-800 bg-red-950/40',
    badge: 'bg-red-950 text-red-400 border-red-800',
    label: 'CRITICAL',
  },
  high: {
    icon: AlertTriangle,
    cls: 'border-orange-800 bg-orange-950/30',
    badge: 'bg-orange-950 text-orange-400 border-orange-800',
    label: 'HIGH',
  },
  medium: {
    icon: AlertCircle,
    cls: 'border-yellow-800 bg-yellow-950/30',
    badge: 'bg-yellow-950 text-yellow-400 border-yellow-800',
    label: 'MEDIUM',
  },
  low: {
    icon: Info,
    cls: 'border-slate-700 bg-dark-600',
    badge: 'bg-slate-800 text-slate-400 border-slate-700',
    label: 'LOW',
  },
};

function formatMoney(n?: number) {
  if (!n) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function EvidencePanel({ evidence, title = 'Evidence' }: EvidencePanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (evidence.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-dark-600 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="font-semibold text-white">{title}</span>
          <span className="text-xs bg-dark-500 text-slate-400 rounded-full px-2 py-0.5">
            {evidence.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-dark-500">
          {evidence.map((ev) => {
            const cfg = severityConfig[ev.severity];
            const Icon = cfg.icon;
            return (
              <div
                key={ev.id}
                className={`px-5 py-4 border-l-4 ${cfg.cls} fade-in`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-current opacity-70" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-sm truncate">
                          {ev.title}
                        </span>
                        <span
                          className={`text-xs font-mono border rounded px-1.5 py-0.5 shrink-0 ${cfg.badge}`}
                        >
                          {cfg.label}
                        </span>
                        {ev.amount && (
                          <span className="text-xs mono text-slate-300 shrink-0">
                            {formatMoney(ev.amount)}
                          </span>
                        )}
                        {ev.date && (
                          <span className="text-xs text-slate-500 shrink-0">{ev.date}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        {ev.description}
                      </p>
                    </div>
                  </div>
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-accent hover:text-blue-300 transition-colors shrink-0 mt-0.5"
                  >
                    <span>{ev.sourceLabel}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
