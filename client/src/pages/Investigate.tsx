import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, X, Play, Square, RotateCcw, Building2, Landmark, User, AlertTriangle,
  TrendingUp, DollarSign, Target, Search, Loader2, Clock, CalendarClock,
  BellRing, FolderX, Database, Users, GitBranch, Zap, ShoppingBag,
} from 'lucide-react';
import { useInvestigation, InvestigationEntity, EntityType } from '../hooks/useInvestigation';
import EntityAnalysisCard from '../components/EntityAnalysisCard';
import LiveFeed from '../components/LiveFeed';
import { searchOrgData } from '../services/api';
import { OrgDataHit } from '../types';

// ── Duration options ──────────────────────────────────────────────────────
const DURATIONS: { label: string; ms: number }[] = [
  { label: 'One-time',  ms: 0 },
  { label: '1 hr',      ms: 60 * 60 * 1000 },
  { label: '6 hrs',     ms: 6 * 60 * 60 * 1000 },
  { label: '12 hrs',    ms: 12 * 60 * 60 * 1000 },
  { label: '1 day',     ms: 24 * 60 * 60 * 1000 },
  { label: '3 days',    ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '1 week',    ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '2 weeks',   ms: 14 * 24 * 60 * 60 * 1000 },
  { label: '1 month',   ms: 30 * 24 * 60 * 60 * 1000 },
];

// Same modes as the search bar — map to the API entity type
type OrgMode = 'people' | 'branches' | 'events' | 'vendors';
const MODE_OPTIONS: { value: OrgMode; label: string; icon: typeof Search; hint: string; entityType: EntityType }[] = [
  { value: 'people',   label: 'People',   icon: Users,       hint: 'Employees & executives',      entityType: 'person'    },
  { value: 'branches', label: 'Branches', icon: GitBranch,   hint: 'Divisions & subsidiaries',    entityType: 'recipient' },
  { value: 'events',   label: 'Events',   icon: Zap,         hint: 'Incidents & occurrences',     entityType: 'recipient' },
  { value: 'vendors',  label: 'Vendors',  icon: ShoppingBag, hint: 'Suppliers & contractors',     entityType: 'recipient' },
];

function modeToEntityType(mode: OrgMode): EntityType {
  return MODE_OPTIONS.find(o => o.value === mode)!.entityType;
}

function formatMoney(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}

function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'ended';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

// ── Org-data entity search input ──────────────────────────────────────────
function EntitySearchInput({
  value,
  onChange,
  type,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type: EntityType;
  placeholder: string;
}) {
  const [suggestions, setSuggestions] = useState<OrgDataHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [noData, setNoData] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const fetch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); setNoData(false); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const hits = await searchOrgData(q);
        setSuggestions(hits.slice(0, 6));
        setNoData(hits.length === 0);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const typeColor = type === 'agency' ? 'text-purple-400' : type === 'person' ? 'text-yellow-400' : 'text-blue-400';

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative flex items-center">
        {loading
          ? <Loader2 className="absolute left-3 w-3.5 h-3.5 text-accent animate-spin pointer-events-none" />
          : <Search className="absolute left-3 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
        }
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); fetch(e.target.value); }}
          onFocus={() => (suggestions.length > 0 || noData) && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-dark-600 border border-dark-500 focus:border-accent rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-dark-600 border border-dark-500 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
          {noData ? (
            <div className="px-3 py-3 text-center">
              <FolderX className="w-5 h-5 text-slate-600 mx-auto mb-1" />
              <p className="text-xs text-slate-400 font-medium">No data matches "{value}"</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Upload connected files to enable suggestions</p>
            </div>
          ) : suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => { onChange(s.name); setSuggestions([]); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-500 transition-colors border-b border-dark-700 last:border-0"
            >
              <Database className={`w-3 h-3 shrink-0 ${typeColor}`} />
              <span className="text-xs text-white truncate flex-1">{s.name}</span>
              <span className="text-[10px] text-slate-600 truncate max-w-[80px]">{s.source}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Investigate() {
  const [inputs, setInputs] = useState<{ name: string; mode: OrgMode }[]>([{ name: '', mode: 'vendors' }]);
  const [inputError, setInputError] = useState('');
  const [duration, setDuration] = useState(0);
  const [tick, setTick] = useState(0);
  const { state, start, stop, cancelSchedule, reset } = useInvestigation();

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  function addInput() {
    if (inputs.length >= 5) return;
    setInputs((prev) => [...prev, { name: '', mode: 'vendors' }]);
  }
  function removeInput(i: number) {
    setInputs((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateInput(i: number, patch: Partial<{ name: string; mode: OrgMode }>) {
    setInputs((prev) => prev.map((inp, idx) => (idx === i ? { ...inp, ...patch } : inp)));
  }

  function handleStart() {
    const valid: InvestigationEntity[] = inputs
      .filter(e => e.name.trim().length > 1)
      .map(e => ({ name: e.name.trim(), type: modeToEntityType(e.mode) }));
    if (valid.length === 0) { setInputError('Add at least one entity to investigate.'); return; }
    setInputError('');
    start(valid, duration);
  }

  const isRunning = state.status === 'running';
  const isIdle = state.status === 'idle';
  const completed = state.entities.filter((e) => e.status === 'complete');
  const primary = state.entities.filter((e) => e.depth === 0);
  const discovered = state.entities.filter((e) => e.depth > 0);
  const isScheduled = !!state.scheduleEndsAt;

  return (
    <div className="flex h-[calc(100vh-52px)] overflow-hidden bg-dark-900">
      {/* ── Left sidebar ── */}
      <aside className="w-72 shrink-0 border-r border-dark-500 flex flex-col bg-dark-800">
        <div className="px-4 py-4 border-b border-dark-500">
          <h2 className="text-sm font-bold text-white mb-0.5">Investigation Workspace</h2>
          <p className="text-xs text-slate-500">Search your connected data to find entities, then the AI investigates them in depth.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {isIdle && (
            <>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Targets</p>

              {inputs.map((inp, i) => (
                <div key={i} className="space-y-1.5 bg-dark-700 border border-dark-500 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-2">
                    <div className="flex rounded-lg overflow-hidden border border-dark-500 flex-1">
                      {MODE_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = inp.mode === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            title={opt.hint}
                            onClick={() => updateInput(i, { mode: opt.value })}
                            className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 text-[11px] font-medium transition-colors ${
                              active ? 'bg-dark-500 text-accent' : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span className="hidden sm:inline truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {inputs.length > 1 && (
                      <button onClick={() => removeInput(i)} className="ml-1 text-slate-600 hover:text-red-400 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <EntitySearchInput
                    value={inp.name}
                    onChange={(v) => updateInput(i, { name: v })}
                    type={modeToEntityType(inp.mode)}
                    placeholder={MODE_OPTIONS.find(o => o.value === inp.mode)?.hint ?? 'Search…'}
                  />
                </div>
              ))}

              {inputs.length < 5 && (
                <button
                  onClick={addInput}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-dark-500 hover:border-accent/50 rounded-xl text-xs text-slate-500 hover:text-accent transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another target
                </button>
              )}

              {inputError && <p className="text-xs text-red-400">{inputError}</p>}

              {/* Duration picker */}
              <div className="bg-dark-700 border border-dark-500 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-accent" />
                  <p className="text-xs font-semibold text-slate-300">Monitor for</p>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.ms}
                      type="button"
                      onClick={() => setDuration(d.ms)}
                      className={`py-1.5 px-1 text-[11px] font-medium rounded-lg transition-colors text-center ${
                        duration === d.ms
                          ? 'bg-accent text-white'
                          : 'bg-dark-600 text-slate-400 hover:text-white hover:bg-dark-500'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {duration > 0 && (
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                    <BellRing className="w-3 h-3" />
                    Email + push alerts when corruption is found. Re-runs every hour until {new Date(Date.now() + duration).toLocaleDateString()}.
                  </p>
                )}
              </div>

              <button
                onClick={handleStart}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                <Play className="w-4 h-4" />
                {duration > 0 ? 'Start & Schedule' : 'Start Investigation'}
              </button>

              <div className="bg-dark-600 border border-dark-500 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
                <p className="font-semibold text-slate-400 mb-1">How it works</p>
                <p>Search your connected data to pick entities. The AI then investigates them using public records and auto-discovers related parties. Set a duration to keep monitoring in the background.</p>
              </div>
            </>
          )}

          {!isIdle && (
            <>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Progress</p>

              {/* Schedule countdown */}
              {isScheduled && state.scheduleEndsAt && (
                <div className="bg-accent/10 border border-accent/30 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-semibold text-accent">Scheduled monitoring active</span>
                  </div>
                  <p className="text-xs text-slate-400">{formatCountdown(state.scheduleEndsAt)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Re-runs hourly · alerts sent on findings</p>
                  <button
                    onClick={cancelSchedule}
                    className="mt-2 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    Cancel schedule
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                {state.entities.map((e) => {
                  const Icon = e.type === 'agency' ? Landmark : e.type === 'person' ? User : Building2;
                  return (
                    <div key={`${e.type}:${e.name}`} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-dark-600 border border-dark-500">
                      <Icon className={`w-3 h-3 shrink-0 ${
                        e.type === 'agency' ? 'text-purple-400' : e.type === 'person' ? 'text-yellow-400' : 'text-blue-400'
                      }`} />
                      <span className="text-xs text-slate-300 truncate flex-1">{e.name}</span>
                      <span className={`text-xs mono shrink-0 ${
                        e.status === 'complete' ? (
                          e.analysis?.riskLevel === 'CRITICAL' ? 'text-red-400' :
                          e.analysis?.riskLevel === 'HIGH'     ? 'text-orange-400' :
                          e.analysis?.riskLevel === 'MODERATE' ? 'text-yellow-400' : 'text-green-400'
                        ) : e.status === 'fetching' ? 'text-accent' : e.status === 'error' ? 'text-red-400' : 'text-slate-600'
                      }`}>
                        {e.status === 'complete' ? `${e.analysis?.overallScore ?? '-'}` :
                         e.status === 'fetching' ? '…' :
                         e.status === 'error'    ? 'err' : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {state.summary && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { icon: Target,        label: 'Critical', value: state.summary.criticalCount, color: 'text-red-400' },
                    { icon: AlertTriangle, label: 'High',     value: state.summary.highCount,     color: 'text-orange-400' },
                    { icon: TrendingUp,    label: 'Analyzed', value: state.summary.totalAnalyzed, color: 'text-accent' },
                    { icon: DollarSign,    label: 'Total',    value: formatMoney(state.summary.totalAmount), color: 'text-white' },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} className="bg-dark-600 border border-dark-500 rounded-xl p-3">
                        <Icon className={`w-3.5 h-3.5 ${s.color} mb-1`} />
                        <p className={`text-sm font-bold mono ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500">{s.label}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {isRunning && (
                  <button onClick={stop} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 text-xs font-semibold rounded-xl transition-colors">
                    <Square className="w-3 h-3" /> Stop
                  </button>
                )}
                <button onClick={reset} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-dark-600 hover:bg-dark-500 border border-dark-500 text-slate-400 text-xs font-semibold rounded-xl transition-colors">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Main workspace ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-dark-500 px-5 py-3 flex items-center gap-4 bg-dark-800/50">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            {state.status === 'idle' ? 'Workspace — ready' :
             isRunning              ? `Investigating — ${completed.length}/${state.entities.length} complete` :
                                     `Complete — ${completed.length} entities analyzed`}
          </span>
          {state.status === 'complete' && state.summary?.topRisk[0] && (
            <span className="text-xs text-red-400 border border-red-900 bg-red-950/40 rounded px-2 py-0.5 mono">
              Highest risk: {state.summary.topRisk[0].name} ({state.summary.topRisk[0].score}/100)
            </span>
          )}
          {isScheduled && (
            <span className="text-xs text-accent border border-accent/30 bg-accent/10 rounded px-2 py-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {tick >= 0 && state.scheduleEndsAt ? formatCountdown(state.scheduleEndsAt) : ''}
            </span>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5">
            {state.status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto gap-4">
                <div className="w-16 h-16 rounded-2xl bg-dark-700 border border-dark-500 flex items-center justify-center">
                  <Target className="w-8 h-8 text-slate-600" />
                </div>
                <div>
                  <p className="text-white font-semibold mb-1">Search your data to begin</p>
                  <p className="text-sm text-slate-500">Type a vendor, employee, or entity from your connected files in the left panel. The AI will investigate using public records and follow the money trail automatically.</p>
                </div>
              </div>
            )}

            {state.entities.length > 0 && (
              <div className="space-y-6">
                {primary.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Primary Targets</p>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {primary.map((e, i) => (
                        <EntityAnalysisCard key={`${e.type}:${e.name}`} entity={e} index={i} />
                      ))}
                    </div>
                  </div>
                )}
                {discovered.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold">Auto-Discovered</p>
                      <span className="text-xs bg-purple-950 border border-purple-900 text-purple-400 rounded-full px-2 py-0.5">{discovered.length}</span>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {discovered.map((e, i) => (
                        <EntityAnalysisCard key={`${e.type}:${e.name}`} entity={e} index={i} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="w-64 shrink-0 border-l border-dark-500 bg-dark-800 overflow-hidden flex flex-col">
            <LiveFeed items={state.feed} isRunning={isRunning} />
          </aside>
        </div>
      </main>
    </div>
  );
}
