import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Building2, User, Landmark, Loader2, X, Users, GitBranch, Zap, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { search } from '../services/api';
import { SearchType } from '../types';
import { useAuth } from '../contexts/AuthContext';

const STD_TYPE_OPTIONS: { value: SearchType; label: string; icon: typeof Search }[] = [
  { value: 'all',       label: 'All',     icon: Search    },
  { value: 'recipient', label: 'Company', icon: Building2 },
  { value: 'agency',    label: 'Agency',  icon: Landmark  },
  { value: 'person',    label: 'Person',  icon: User      },
];

type OrgMode = 'people' | 'branches' | 'events' | 'vendors';
const ORG_TYPE_OPTIONS: { value: OrgMode; label: string; icon: typeof Search; hint: string }[] = [
  { value: 'people',   label: 'People',   icon: Users,        hint: 'Search employees & executives' },
  { value: 'branches', label: 'Branches', icon: GitBranch,    hint: 'Divisions & subsidiaries' },
  { value: 'events',   label: 'Events',   icon: Zap,          hint: 'Incidents & occurrences' },
  { value: 'vendors',  label: 'Vendors',  icon: ShoppingBag,  hint: 'Suppliers & contractors' },
];

interface Suggestion {
  label: string;
  type: SearchType;
  sub: string;
  industry?: string;
  description?: string;
  source?: 'usaspending' | 'web';
  amount?: number;
}

function formatMoney(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const { user } = useAuth();
  const orgName = user?.orgDisplayName ?? user?.orgName ?? '';
  const hasOrg = !!orgName;

  const [query, setQuery] = useState('');
  const [stdType, setStdType] = useState<SearchType>('all');
  const [orgMode, setOrgMode] = useState<OrgMode>('people');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const searchQ = hasOrg
        ? orgMode === 'people'   ? `${q} ${orgName} employee executive`
        : orgMode === 'branches' ? `${q} ${orgName} division branch`
        : orgMode === 'events'   ? `${q} ${orgName} incident`
        :                          q
        : q;

      const res = await search(searchQ);
      const suggs: Suggestion[] = [];

      if (!hasOrg || orgMode === 'vendors') {
        for (const r of res.recipients.slice(0, 3)) {
          suggs.push({ label: r.name, type: 'recipient', sub: r.topAgency || 'Federal Contractor', amount: r.totalAmount, source: 'usaspending' });
        }
        for (const a of res.agencies.slice(0, 2)) {
          suggs.push({ label: a.name, type: 'agency', sub: 'Government Agency', amount: a.totalAmount, source: 'usaspending' });
        }
      }

      for (const w of (res.webResults ?? []).slice(0, hasOrg ? 7 : 4)) {
        if (!w.name || w.name.length < 2) continue;
        const resolvedType: SearchType = orgMode === 'people' ? 'person' : 'recipient';
        suggs.push({
          label: w.name,
          type: hasOrg ? resolvedType : 'recipient',
          sub: w.industry || 'Organization',
          description: w.description,
          industry: w.industry,
          source: 'web',
        });
      }

      setSuggestions(suggs);
      setShowDrop(suggs.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [hasOrg, orgMode, orgName]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  function buildNavUrl(label: string, type: SearchType): string {
    if (hasOrg) {
      const contextQuery =
        orgMode === 'people'   ? `${label} at ${orgName}` :
        orgMode === 'branches' ? `${label} ${orgName}` :
        orgMode === 'events'   ? `${label} ${orgName}` :
        label;
      const analysisType = orgMode === 'people' ? 'person' : 'recipient';
      return `/analysis/${analysisType}/${encodeURIComponent(contextQuery)}?org=${encodeURIComponent(orgName)}`;
    }
    const resolvedType = type === 'all' ? 'recipient' : type;
    return `/analysis/${resolvedType}/${encodeURIComponent(label)}`;
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    const type: SearchType = hasOrg ? (orgMode === 'people' ? 'person' : 'recipient') : stdType;
    navigate(buildNavUrl(query.trim(), type));
    setShowDrop(false);
  }

  function handleSelect(s: Suggestion) {
    setQuery(s.label);
    setShowDrop(false);
    navigate(buildNavUrl(s.label, s.type));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDrop) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]); }
    else if (e.key === 'Escape') setShowDrop(false);
  }

  const placeholder = hasOrg
    ? orgMode === 'people'   ? `Search people at ${orgName}…`
    : orgMode === 'branches' ? `Search branches of ${orgName}…`
    : orgMode === 'events'   ? `Search events involving ${orgName}…`
    :                          `Search vendors supplying ${orgName}…`
    : 'Search agencies, companies, people…';

  return (
    <div className="relative w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-dark-700 border-2 border-dark-500 focus-within:border-accent rounded-xl transition-colors overflow-hidden shadow-2xl">
          <div className="pl-4 pr-2 flex items-center">
            {loading
              ? <Loader2 className="w-5 h-5 text-accent animate-spin" />
              : <Search className="w-5 h-5 text-slate-500" />
            }
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowDrop(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent py-4 px-2 text-white placeholder-slate-500 outline-none text-base"
            autoComplete="off"
          />

          {query && (
            <button type="button" onClick={() => { setQuery(''); setSuggestions([]); setShowDrop(false); }}
              className="px-2 text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="border-l border-dark-500 flex">
            {hasOrg
              ? ORG_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button key={opt.value} type="button" onClick={() => setOrgMode(opt.value)}
                      title={opt.hint}
                      className={`px-2.5 py-4 transition-colors ${orgMode === opt.value ? 'text-accent bg-dark-600' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })
              : STD_TYPE_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setStdType(opt.value)}
                    className={`px-3 py-4 text-xs font-medium transition-colors ${stdType === opt.value ? 'text-accent bg-dark-600' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {opt.label}
                  </button>
                ))
            }
          </div>

          <button type="submit" disabled={!query.trim()}
            className="bg-accent hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-4 transition-colors">
            <Search className="w-4 h-4" />
          </button>
        </div>
      </form>

      {hasOrg && (
        <p className="text-xs text-slate-500 mt-1.5 ml-1">
          {ORG_TYPE_OPTIONS.find(o => o.value === orgMode)?.hint}
        </p>
      )}

      {showDrop && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl overflow-hidden z-50 fade-in">
          {suggestions.map((s, i) => (
            <button
              key={`${s.label}-${i}`}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${activeIdx === i ? 'bg-dark-600' : 'hover:bg-dark-600'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                s.type === 'agency'  ? 'bg-purple-950 text-purple-400' :
                s.type === 'person' ? 'bg-yellow-950 text-yellow-400' :
                                      'bg-blue-950 text-blue-400'
              }`}>
                {s.type === 'agency'  ? <Landmark  className="w-4 h-4" />
                 : s.type === 'person' ? <User      className="w-4 h-4" />
                 :                       <Building2 className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{s.label}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-slate-500 text-xs">{s.sub}</span>
                  {s.industry && s.industry !== s.sub && (
                    <span className="text-xs bg-dark-500 text-slate-400 rounded-full px-1.5 py-0.5">{s.industry}</span>
                  )}
                </div>
                {s.description && (
                  <p className="text-slate-600 text-xs mt-0.5 line-clamp-1">{s.description}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {s.amount != null && s.amount > 0 && (
                  <span className="text-xs mono text-slate-400">{formatMoney(s.amount)}</span>
                )}
                {s.source === 'web' && (
                  <span className="text-xs text-slate-600 italic">web</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
