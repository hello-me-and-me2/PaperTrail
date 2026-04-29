import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Landmark,
  User,
  ExternalLink,
  ChevronRight,
  Loader2,
  RefreshCw,
  Database,
  Users,
} from 'lucide-react';
import { analyzeRecipient, analyzeAgency, analyzePerson } from '../services/api';
import { CorruptionAnalysis, SpendingOverTime } from '../types';
import CorruptionScore from '../components/CorruptionScore';
import RiskBadge from '../components/RiskBadge';
import EvidencePanel from '../components/EvidencePanel';
import SpendingChart from '../components/SpendingChart';
import ContractTable from '../components/ContractTable';
import SearchBar from '../components/SearchBar';

type EntityType = 'recipient' | 'agency' | 'person';

const entityConfig = {
  recipient: { icon: Building2, label: 'Federal Contractor', color: 'text-blue-400', bg: 'bg-blue-950' },
  agency:    { icon: Landmark,  label: 'Government Agency', color: 'text-purple-400', bg: 'bg-purple-950' },
  person:    { icon: User,      label: 'Person / Keyword', color: 'text-yellow-400', bg: 'bg-yellow-950' },
};

function formatMoney(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function RiskBar({ score, label, detail }: { score: number; label: string; detail: string }) {
  const color = score >= 35 ? 'bg-red-500' : score >= 25 ? 'bg-orange-500' : score >= 15 ? 'bg-yellow-500' : 'bg-blue-500';
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-white font-medium">{label}</span>
        <span className="text-sm mono text-slate-300">{score.toFixed(0)}/40</span>
      </div>
      <div className="h-2 bg-dark-500 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${Math.min(100, (score / 40) * 100)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export default function Analysis() {
  const { type, name } = useParams<{ type: EntityType; name: string }>();
  const [searchParams] = useSearchParams();
  const orgContext = searchParams.get('org') ?? undefined;

  const [data, setData] = useState<(CorruptionAnalysis & { spendingOverTime?: SpendingOverTime[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const decodedName = name ? decodeURIComponent(name) : '';
  const entityType = (type as EntityType) || 'recipient';
  const cfg = entityConfig[entityType] || entityConfig.recipient;
  const Icon = cfg.icon;

  async function load() {
    if (!decodedName) return;
    setLoading(true);
    setError(null);
    try {
      let result: CorruptionAnalysis & { spendingOverTime?: SpendingOverTime[] };
      if (entityType === 'agency') result = await analyzeAgency(decodedName, orgContext);
      else if (entityType === 'person') result = await analyzePerson(decodedName, orgContext);
      else result = await analyzeRecipient(decodedName, orgContext);
      setData(result);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load analysis. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [decodedName, entityType, orgContext]);

  const isCritical = data?.riskLevel === 'CRITICAL';

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-300 truncate">{decodedName}</span>
        </div>

        <div className="mb-6 flex justify-center">
          <SearchBar />
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-accent" />
            <div className="text-center">
              <p className="text-white font-medium">
                {orgContext ? `Analyzing in context of ${orgContext}…` : 'AI is analyzing all available sources…'}
              </p>
              <p className="text-sm">Searching news, court records, USASpending.gov &amp; Federal Register — this may take 20–40 seconds</p>
              {orgContext && data === null && (
                <p className="text-xs text-accent mt-1">Including your organization's uploaded data</p>
              )}
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="max-w-lg mx-auto card border-red-900 p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">Analysis failed</p>
            <p className="text-sm text-slate-400 mb-4">{error}</p>
            <button onClick={load} className="btn-primary flex items-center gap-2 mx-auto">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6 fade-in">
            <div className={`card p-6 ${isCritical ? 'critical-glow border-red-900' : ''}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <CorruptionScore score={data.overallScore} level={data.riskLevel} />

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-md ${cfg.bg} flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    <RiskBadge level={data.riskLevel} size="sm" />
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
                    {data.entityName}
                  </h1>

                  <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-2xl">
                    {data.summary}
                  </p>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs uppercase tracking-wider block">Total Awards</span>
                      <span className="text-white font-semibold mono">{data.totalAwards.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs uppercase tracking-wider block">Total Amount</span>
                      <span className="text-white font-semibold mono">{formatMoney(data.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs uppercase tracking-wider block">Risk Factors</span>
                      <span className="text-white font-semibold mono">{data.riskFactors.length}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <a
                    href={`https://www.usaspending.gov/search/?query=${encodeURIComponent(data.entityName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-accent hover:text-blue-300 border border-dark-500 hover:border-accent/40 rounded-lg px-3 py-2 transition-colors"
                  >
                    <Database className="w-3.5 h-3.5" />
                    View on USASpending.gov
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {data.riskFactors.length > 0 && (
                  <div className="card p-5">
                    <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      Risk Factor Breakdown
                    </h2>
                    {data.riskFactors.map((rf) => (
                      <div key={rf.name} className="mb-6 last:mb-0">
                        <RiskBar score={rf.score} label={rf.name} detail={rf.description} />
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">{rf.detail}</p>
                      </div>
                    ))}
                  </div>
                )}

                {data.riskFactors.flatMap((rf) => rf.evidence).length > 0 && (
                  <EvidencePanel
                    title="Supporting Evidence"
                    evidence={data.riskFactors.flatMap((rf) => rf.evidence)}
                  />
                )}

                <ContractTable contracts={data.topContracts} />
              </div>

              <div className="space-y-4">
                {data.spendingOverTime && data.spendingOverTime.length > 0 && (
                  <SpendingChart data={data.spendingOverTime} title="Annual Spending (FY)" />
                )}

                {data.responsibleParties.length > 0 && (
                  <div className="card p-5">
                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      Responsible Parties
                    </h3>
                    <div className="space-y-4">
                      {data.responsibleParties.map((p, i) => (
                        <div key={i} className="border-l-2 border-dark-500 pl-3">
                          <p className="text-white text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-accent mb-1">{p.role}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{p.relevance}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card p-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sources Queried</h3>
                  <div className="space-y-1.5">
                    {(data.sourcesQueried ?? ['USASpending.gov', 'FederalRegister.gov']).map((src) => (
                      <div key={src} className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        <span>{src}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    Last analyzed: {new Date(data.lastUpdated).toLocaleString()}.
                  </p>
                </div>

                <div className="card border-yellow-900/40 p-4 bg-yellow-950/10">
                  <p className="text-xs text-yellow-700 leading-relaxed">
                    <strong className="text-yellow-600">Disclaimer:</strong> Risk scores are based on objective spending pattern analysis using public data. A high score indicates anomalous patterns, not proven wrongdoing. Consult official IG reports or legal counsel for determinations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && data.totalAwards === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-white font-medium mb-1">No federal awards found</p>
            <p className="text-sm">No records matched "{decodedName}" in the federal spending database.</p>
            <Link to="/" className="mt-4 inline-block text-accent hover:underline text-sm">Try a different search</Link>
          </div>
        )}
      </div>
    </div>
  );
}
