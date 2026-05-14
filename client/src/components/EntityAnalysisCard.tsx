import { useState } from 'react';
import { Building2, Landmark, User, Loader2, AlertCircle, ChevronDown, ChevronUp, ExternalLink, Compass } from 'lucide-react';
import { EntityResult } from '../hooks/useInvestigation';
import CorruptionScore from './CorruptionScore';
import RiskBadge from './RiskBadge';
import EvidencePanel from './EvidencePanel';
import SpendingChart from './SpendingChart';

function formatMoney(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const typeConfig = {
  recipient: { icon: Building2, label: 'Contractor',    color: 'text-blue-400',   bg: 'bg-blue-950/60',   border: 'border-blue-900/40' },
  agency:    { icon: Landmark,  label: 'Agency',        color: 'text-purple-400', bg: 'bg-purple-950/60', border: 'border-purple-900/40' },
  person:    { icon: User,      label: 'Person/Keyword',color: 'text-yellow-400', bg: 'bg-yellow-950/60', border: 'border-yellow-900/40' },
};

interface Props {
  entity: EntityResult;
  index: number;
}

export default function EntityAnalysisCard({ entity, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cfg = typeConfig[entity.type];
  const Icon = cfg.icon;
  const isDiscovered = entity.depth > 0;
  const analysis = entity.analysis;

  const borderColor = analysis
    ? analysis.riskLevel === 'CRITICAL' ? 'border-red-800'
    : analysis.riskLevel === 'HIGH'     ? 'border-orange-800'
    : analysis.riskLevel === 'MODERATE' ? 'border-yellow-900'
    : 'border-dark-500'
    : 'border-dark-500';

  return (
    <div
      className={`bg-dark-700 border rounded-xl overflow-hidden fade-in ${borderColor}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            {isDiscovered && (
              <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-950/40 border border-purple-900/40 rounded px-1.5 py-0.5">
                <Compass className="w-2.5 h-2.5" /> Discovered
              </span>
            )}
          </div>
          <h3 className="font-semibold text-white text-sm leading-snug truncate">{entity.name}</h3>
          {isDiscovered && entity.reason && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{entity.reason}</p>
          )}
        </div>

        {/* Status / Score */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {entity.status === 'queued' && (
            <span className="text-xs text-slate-500 bg-dark-500 rounded px-2 py-0.5">Queued</span>
          )}
          {entity.status === 'fetching' && (
            <span className="flex items-center gap-1 text-xs text-accent">
              <Loader2 className="w-3 h-3 animate-spin" /> Analyzing…
            </span>
          )}
          {entity.status === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="w-3 h-3" /> Error
            </span>
          )}
          {entity.status === 'complete' && analysis && (
            <div className="flex items-center gap-2">
              <CorruptionScore score={analysis.overallScore} level={analysis.riskLevel} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {entity.status === 'fetching' && (
        <div className="px-4 pb-3 space-y-2">
          {[80, 60, 40].map((w, i) => (
            <div key={i} className="h-2 bg-dark-500 rounded animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {/* Summary row when complete */}
      {entity.status === 'complete' && analysis && (
        <>
          <div className="px-4 pb-3 grid grid-cols-3 gap-3 text-xs border-t border-dark-500 pt-3">
            <div>
              <p className="text-slate-500 mb-0.5">Awards</p>
              <p className="text-white font-semibold mono">{analysis.totalAwards.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Total Spend</p>
              <p className="text-white font-semibold mono">{formatMoney(analysis.totalAmount)}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">Red Flags</p>
              <p className="text-white font-semibold mono">{analysis.riskFactors.length}</p>
            </div>
          </div>

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full flex items-center justify-center gap-1 py-2 border-t border-dark-500 text-xs text-slate-500 hover:text-slate-300 hover:bg-dark-600 transition-colors"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Hide details</> : <><ChevronDown className="w-3 h-3" /> Show details</>}
          </button>

          {expanded && (
            <div className="border-t border-dark-500 space-y-4 p-4">
              <p className="text-xs text-slate-400 leading-relaxed">{analysis.summary}</p>

              {entity.spendingOverTime && entity.spendingOverTime.length > 0 && (
                <SpendingChart data={entity.spendingOverTime} title="Annual Spending" />
              )}

              {analysis.riskFactors.flatMap((rf) => rf.evidence).length > 0 && (
                <EvidencePanel evidence={analysis.riskFactors.flatMap((rf) => rf.evidence)} title="Evidence" />
              )}

              <a
                href={`/analysis/${entity.type}/${encodeURIComponent(entity.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-accent hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Open full analysis
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
