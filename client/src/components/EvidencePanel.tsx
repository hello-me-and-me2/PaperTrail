import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, Zap, ShieldCheck, Database } from 'lucide-react';
import { Evidence } from '../types';

interface Props { evidence: Evidence[]; title?: string; }

const severityConfig = {
  critical: { icon: Zap,           cls: 'border-red-800 bg-red-950/40',       badge: 'bg-red-950 text-red-400 border-red-800',       label: 'CRITICAL' },
  high:     { icon: AlertTriangle, cls: 'border-orange-800 bg-orange-950/30', badge: 'bg-orange-950 text-orange-400 border-orange-800', label: 'HIGH' },
  medium:   { icon: AlertCircle,   cls: 'border-yellow-800 bg-yellow-950/30', badge: 'bg-yellow-950 text-yellow-400 border-yellow-800', label: 'MEDIUM' },
  low:      { icon: Info,          cls: 'border-slate-700 bg-dark-600',        badge: 'bg-slate-800 text-slate-400 border-slate-700',   label: 'LOW' },
};

const KNOWN_SOURCE_COLORS: Record<string, string> = {
  'USASpending':    'bg-blue-950 text-blue-400 border-blue-900',
  'FederalRegiste': 'bg-amber-950 text-amber-400 border-amber-900',
  'Reuters':        'bg-orange-950 text-orange-400 border-orange-900',
  'ProPublica':     'bg-indigo-950 text-indigo-400 border-indigo-900',
};

function isOrgFile(label: string) {
  const knownPrefixes = Object.keys(KNOWN_SOURCE_COLORS);
  return !knownPrefixes.some(p => label.startsWith(p)) && !label.startsWith('Web') && !label.startsWith('AI');
}

function sourceClass(label: string) {
  for (const [prefix, cls] of Object.entries(KNOWN_SOURCE_COLORS)) {
    if (label.startsWith(prefix)) return cls;
  }
  if (isOrgFile(label)) return 'bg-green-950 text-green-400 border-green-900';
  return 'bg-slate-800 text-slate-400 border-slate-700';
}

function fmt(n?: number) {
  if (!n) return null;
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
  return `$${n}`;
}

export default function EvidencePanel({ evidence, title = 'Evidence' }: Props) {
  const [expanded, setExpanded] = useState(true);
  if (!evidence.length) return null;

  // Show highest-confidence items first
  const sorted = [...evidence].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-dark-600 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="font-semibold text-white">{title}</span>
          <span className="text-xs bg-dark-500 text-slate-400 rounded-full px-2 py-0.5">{evidence.length}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="divide-y divide-dark-500">
          {sorted.map(ev => {
            const cfg  = severityConfig[ev.severity];
            const Icon = cfg.icon;
            return (
              <div key={ev.id} className={`px-5 py-4 border-l-4 ${cfg.cls} fade-in`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                    <div className="min-w-0">
                      {/* Title row */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="font-semibold text-white text-sm truncate">{ev.title}</span>
                        <span className={`text-xs font-mono border rounded px-1.5 py-0.5 shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                        {ev.amount && <span className="text-xs mono text-slate-300 shrink-0">{fmt(ev.amount)}</span>}
                        {ev.date   && <span className="text-xs text-slate-500 shrink-0">{ev.date}</span>}
                      </div>
                      {/* Description */}
                      <p className="text-sm text-slate-400 leading-relaxed mb-2">{ev.description}</p>
                      {/* Source + confidence row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`flex items-center gap-1 text-xs border rounded px-2 py-0.5 font-medium ${sourceClass(ev.sourceLabel)}`}>
                          {isOrgFile(ev.sourceLabel) && <Database className="w-2.5 h-2.5 shrink-0" />}
                          {ev.sourceLabel.split(' — ')[0]}
                        </span>
                        {ev.confidence != null && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <ShieldCheck className="w-3 h-3" />
                            {ev.confidence}% confidence
                          </span>
                        )}
                        {(ev.sources ?? []).length > 1 && (
                          <span className="text-xs text-green-400 border border-green-900 bg-green-950/40 rounded px-1.5 py-0.5">
                            {ev.sources!.length} sources corroborate
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {ev.sourceUrl && (
                    <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-accent hover:text-blue-300 transition-colors shrink-0 mt-0.5">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
