import { useState } from 'react';
import { Plus, X, Play, Square, RotateCcw, Building2, Landmark, User, AlertTriangle, TrendingUp, DollarSign, Target } from 'lucide-react';
import { useInvestigation, InvestigationEntity, EntityType } from '../hooks/useInvestigation';
import EntityAnalysisCard from '../components/EntityAnalysisCard';
import LiveFeed from '../components/LiveFeed';

const TYPE_OPTIONS: { value: EntityType; label: string; icon: typeof Building2; color: string; bg: string }[] = [
  { value: 'recipient', label: 'Company',  icon: Building2, color: 'text-blue-400',   bg: 'bg-blue-950/50 border-blue-900/50' },
  { value: 'agency',    label: 'Agency',   icon: Landmark,  color: 'text-purple-400', bg: 'bg-purple-950/50 border-purple-900/50' },
  { value: 'person',    label: 'Person',   icon: User,      color: 'text-yellow-400', bg: 'bg-yellow-950/50 border-yellow-900/50' },
];

function formatMoney(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}

export default function Investigate() {
  const [inputs, setInputs] = useState<InvestigationEntity[]>([{ name: '', type: 'recipient' }]);
  const [inputError, setInputError] = useState('');
  const { state, start, stop, reset } = useInvestigation();

  function addInput() {
    if (inputs.length >= 5) return;
    setInputs((prev) => [...prev, { name: '', type: 'recipient' }]);
  }

  function removeInput(i: number) {
    setInputs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateInput(i: number, patch: Partial<InvestigationEntity>) {
    setInputs((prev) => prev.map((inp, idx) => (idx === i ? { ...inp, ...patch } : inp)));
  }

  function handleStart() {
    const valid = inputs.filter((e) => e.name.trim().length > 1);
    if (valid.length === 0) { setInputError('Add at least one entity to investigate.'); return; }
    setInputError('');
    start(valid);
  }

  const isRunning = state.status === 'running';
  const isIdle = state.status === 'idle';

  const completed = state.entities.filter((e) => e.status === 'complete');
  const primary = state.entities.filter((e) => e.depth === 0);
  const discovered = state.entities.filter((e) => e.depth > 0);

  return (
    <div className="flex h-[calc(100vh-52px)] overflow-hidden bg-dark-900">
      {/* ── Left sidebar: builder + summary ── */}
      <aside className="w-72 shrink-0 border-r border-dark-500 flex flex-col bg-dark-800">
        <div className="px-4 py-4 border-b border-dark-500">
          <h2 className="text-sm font-bold text-white mb-0.5">Investigation Workspace</h2>
          <p className="text-xs text-slate-500">Add entities — the AI will analyze them in parallel and auto-discover related parties.</p>
        </div>

        {/* Entity inputs */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {isIdle && (
            <>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Targets</p>
              {inputs.map((inp, i) => (
                <div key={i} className="space-y-1.5 bg-dark-700 border border-dark-500 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex rounded-lg overflow-hidden border border-dark-500">
                      {TYPE_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => updateInput(i, { type: opt.value })}
                            className={`px-2 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${
                              inp.type === opt.value
                                ? `${opt.bg} ${opt.color} border`
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {inputs.length > 1 && (
                      <button onClick={() => removeInput(i)} className="ml-auto text-slate-600 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={inp.name}
                    onChange={(e) => updateInput(i, { name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && i === inputs.length - 1) addInput(); }}
                    placeholder={
                      inp.type === 'recipient' ? 'e.g. Boeing' :
                      inp.type === 'agency'    ? 'e.g. Dept of Defense' :
                      'e.g. Eric Schmidt'
                    }
                    className="w-full bg-dark-600 border border-dark-500 focus:border-accent rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors"
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

              <button
                onClick={handleStart}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                <Play className="w-4 h-4" /> Start Investigation
              </button>

              <div className="bg-dark-600 border border-dark-500 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
                <p className="font-semibold text-slate-400 mb-1">How it works</p>
                <p>The AI runs all targets simultaneously, then automatically discovers and investigates related entities — agencies that issued no-bid contracts, contractors receiving concentrated awards, and more.</p>
              </div>
            </>
          )}

          {!isIdle && (
            <>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Progress</p>

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
                    { icon: Target,       label: 'Critical', value: state.summary.criticalCount, color: 'text-red-400' },
                    { icon: AlertTriangle, label: 'High',    value: state.summary.highCount,     color: 'text-orange-400' },
                    { icon: TrendingUp,   label: 'Analyzed', value: state.summary.totalAnalyzed, color: 'text-accent' },
                    { icon: DollarSign,   label: 'Total',    value: formatMoney(state.summary.totalAmount), color: 'text-white' },
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
        {/* Column headers */}
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
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Cards area */}
          <div className="flex-1 overflow-y-auto p-5">
            {state.status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto gap-4">
                <div className="w-16 h-16 rounded-2xl bg-dark-700 border border-dark-500 flex items-center justify-center">
                  <Target className="w-8 h-8 text-slate-600" />
                </div>
                <div>
                  <p className="text-white font-semibold mb-1">Add targets to begin</p>
                  <p className="text-sm text-slate-500">Enter companies, agencies, or people in the left panel. The AI will analyze all of them in parallel and follow the money trail automatically.</p>
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

          {/* Live feed sidebar */}
          <aside className="w-64 shrink-0 border-l border-dark-500 bg-dark-800 overflow-hidden flex flex-col">
            <LiveFeed items={state.feed} isRunning={isRunning} />
          </aside>
        </div>
      </main>
    </div>
  );
}
