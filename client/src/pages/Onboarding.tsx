import { useState, useEffect, useRef } from 'react';
import { FileText, Building2, Landmark, Users, Search, Loader2, CheckCircle2, ArrowRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { searchOrgs } from '../services/api';
import { OrgSuggestion } from '../types';

type OrgType = 'government_agency' | 'organization' | 'company';

const ORG_TYPES: { value: OrgType; label: string; icon: typeof Building2; desc: string }[] = [
  {
    value: 'government_agency',
    label: 'Government Agency',
    icon: Landmark,
    desc: 'Federal, state, or local government bodies, departments, and commissions',
  },
  {
    value: 'organization',
    label: 'Organization',
    icon: Users,
    desc: 'Nonprofits, foundations, associations, NGOs, and institutes',
  },
  {
    value: 'company',
    label: 'Company',
    icon: Building2,
    desc: 'For-profit businesses, corporations, LLCs, and enterprises',
  },
];

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  government_agency: 'government agency',
  organization: 'organization',
  company: 'company',
};

const PAPER_BG: React.CSSProperties = {
  backgroundColor: '#fdf8ef',
  backgroundImage: [
    'radial-gradient(ellipse 90% 55% at 22% 20%, rgba(255,255,255,0.42) 0%, transparent 70%)',
    'radial-gradient(ellipse 60% 45% at 78% 68%, rgba(0,0,0,0.022) 0%, transparent 70%)',
    'radial-gradient(ellipse 45% 35% at 8% 82%, rgba(255,255,255,0.28) 0%, transparent 60%)',
    'linear-gradient(90deg, transparent 70px, rgba(244,164,164,0.5) 70px, rgba(244,164,164,0.5) 72px, transparent 72px)',
    'repeating-linear-gradient(180deg, transparent 0, transparent 27px, rgba(180,210,245,0.62) 27px, rgba(180,210,245,0.62) 28.5px)',
  ].join(', '),
};

export default function Onboarding() {
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState<'type' | 'name'>('type');
  const [orgType, setOrgType] = useState<OrgType | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<OrgSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<OrgSuggestion | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced org search
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchOrgs(query);
        setSuggestions(results);
        setShowDrop(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  function handleSelectType(t: OrgType) {
    setOrgType(t);
    setStep('name');
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  function handlePickSuggestion(s: OrgSuggestion) {
    setSelected(s);
    setQuery(s.name);
    setShowDrop(false);
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    setSelected(null); // clear selection when user edits
  }

  async function handleConfirm() {
    const orgName = selected?.name || query.trim();
    if (!orgName || !orgType) return;
    setSaving(true);
    setError('');
    try {
      await completeOnboarding({
        org_name: orgName,
        org_type: orgType,
        org_display_name: orgName,
      });
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  const displayName = selected?.name || query.trim();
  const canConfirm = displayName.length >= 2 && !!orgType;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={PAPER_BG}>
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">
            Paper<span className="text-accent">Trail</span>
          </span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'type' ? 'bg-accent text-white' : 'bg-green-500 text-white'}`}>
            {step === 'type' ? '1' : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div className={`h-0.5 w-12 rounded ${step === 'name' ? 'bg-accent' : 'bg-slate-300'}`} />
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'name' ? 'bg-accent text-white' : 'bg-slate-200 text-slate-400'}`}>
            2
          </div>
        </div>

        {/* ── Step 1: Type selection ── */}
        {step === 'type' && (
          <div className="bg-white/85 border border-slate-200 rounded-2xl p-8 shadow-sm fade-in">
            <h1 className="text-xl font-bold text-slate-900 mb-1">What type of organization do you represent?</h1>
            <p className="text-sm text-slate-500 mb-6">This helps us tailor the corruption risk analysis to your context.</p>

            <div className="space-y-3">
              {ORG_TYPES.map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => handleSelectType(value)}
                  className="w-full flex items-center gap-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-accent/50 rounded-xl px-5 py-4 text-left transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-accent/10 flex items-center justify-center shrink-0 transition-colors">
                    <Icon className="w-5 h-5 text-slate-600 group-hover:text-accent transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-sm">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-accent transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Name search ── */}
        {step === 'name' && orgType && (
          <div className="bg-white/85 border border-slate-200 rounded-2xl p-8 shadow-sm fade-in">
            <button
              onClick={() => { setStep('type'); setQuery(''); setSelected(null); setSuggestions([]); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors mb-5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <h1 className="text-xl font-bold text-slate-900 mb-1">
              What's the name of your {ORG_TYPE_LABELS[orgType]}?
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              Search for it below — we'll find it and confirm the right one.
            </p>

            <div className="relative" ref={dropRef}>
              <div className="flex items-center border-2 border-slate-200 focus-within:border-accent rounded-xl overflow-hidden transition-colors bg-white">
                <div className="pl-4 pr-2">
                  {searching
                    ? <Loader2 className="w-4 h-4 text-accent animate-spin" />
                    : <Search className="w-4 h-4 text-slate-400" />
                  }
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowDrop(true)}
                  placeholder={`Search for your ${ORG_TYPE_LABELS[orgType]}…`}
                  className="flex-1 py-3.5 pr-4 text-slate-900 placeholder-slate-400 outline-none text-sm bg-transparent"
                  autoComplete="off"
                />
              </div>

              {/* Dropdown */}
              {showDrop && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 fade-in">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handlePickSuggestion(s)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800 truncate">{s.name}</span>
                          <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 shrink-0">{s.type}</span>
                          {s.industry && (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5 shrink-0">{s.industry}</span>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{s.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                  {/* Manual entry option */}
                  <button
                    onClick={() => { setSelected(null); setShowDrop(false); }}
                    className="w-full px-4 py-2.5 text-left text-xs text-slate-400 hover:bg-slate-50 transition-colors border-t border-slate-100"
                  >
                    Use "<span className="font-medium text-slate-600">{query}</span>" as entered
                  </button>
                </div>
              )}
            </div>

            {/* Selected / typed org preview */}
            {displayName.length >= 2 && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg fade-in">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-800 truncate block">{displayName}</span>
                  <span className="text-xs text-slate-500">
                    {selected?.type ?? ORG_TYPES.find(t => t.value === orgType)?.label}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 text-xs text-red-500">{error}</p>
            )}

            <button
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-accent hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up your workspace…</>
                : <>Confirm &amp; Start <ArrowRight className="w-4 h-4" /></>
              }
            </button>

            <p className="text-center text-xs text-slate-400 mt-4">
              You can only set this once. Contact support to change it later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
