import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Building2, User, Loader2, X, Users, GitBranch, Zap, ShoppingBag, Database, FolderX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchOrgData } from '../services/api';
import { OrgDataHit } from '../types';
import { useAuth } from '../contexts/AuthContext';

type OrgMode = 'people' | 'branches' | 'events' | 'vendors';

const ORG_MODE_OPTIONS: { value: OrgMode; label: string; icon: typeof Search; hint: string }[] = [
  { value: 'people',   label: 'People',   icon: Users,       hint: 'Search employees & executives in your data' },
  { value: 'branches', label: 'Branches', icon: GitBranch,   hint: 'Divisions & subsidiaries in your data' },
  { value: 'events',   label: 'Events',   icon: Zap,         hint: 'Incidents & occurrences in your data' },
  { value: 'vendors',  label: 'Vendors',  icon: ShoppingBag, hint: 'Suppliers & contractors in your data' },
];

interface Suggestion {
  name: string;
  detail: string;
  source: string;
  mode: OrgMode;
}

export default function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const { user } = useAuth();
  const orgName = user?.orgDisplayName ?? user?.orgName ?? '';

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<OrgMode>('people');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [noData, setNoData] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string, m: OrgMode) => {
    if (q.length < 2) { setSuggestions([]); setNoData(false); setShowDrop(false); return; }
    setLoading(true);
    try {
      const hits: OrgDataHit[] = await searchOrgData(q);
      if (hits.length === 0) {
        setSuggestions([]);
        setNoData(true);
      } else {
        setNoData(false);
        setSuggestions(hits.map(h => ({ ...h, mode: m })));
      }
      setShowDrop(true);
    } catch {
      setSuggestions([]);
      setNoData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]); setShowDrop(false); setNoData(false); return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(query, mode), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode, fetchSuggestions]);

  function handleSelect(s: Suggestion) {
    setQuery(s.name);
    setShowDrop(false);
    const analysisType = s.mode === 'people' ? 'person' : 'recipient';
    const org = orgName ? `?org=${encodeURIComponent(orgName)}` : '';
    navigate(`/analysis/${analysisType}/${encodeURIComponent(s.name)}${org}`);
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim() || noData || suggestions.length === 0) return;
    if (activeIdx >= 0 && suggestions[activeIdx]) {
      handleSelect(suggestions[activeIdx]);
    } else {
      handleSelect(suggestions[0]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDrop) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]); }
    else if (e.key === 'Escape') setShowDrop(false);
  }

  function clearQuery() {
    setQuery('');
    setSuggestions([]);
    setShowDrop(false);
    setNoData(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  const currentMode = ORG_MODE_OPTIONS.find(o => o.value === mode)!;
  const placeholder = orgName
    ? `Search ${mode} in ${orgName}'s connected data…`
    : `Search your connected data…`;

  return (
    <div className="relative w-full max-w-2xl" ref={dropRef}>
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
            onFocus={() => (suggestions.length > 0 || noData) && setShowDrop(true)}
            placeholder={placeholder}
            className="flex-1 bg-transparent py-4 px-2 text-white placeholder-slate-500 outline-none text-base"
            autoComplete="off"
          />

          {query && (
            <button type="button" onClick={clearQuery} className="px-2 text-slate-600 hover:text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="border-l border-dark-500 flex">
            {ORG_MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.hint}
                  onClick={() => { setMode(opt.value); setSuggestions([]); setShowDrop(false); setNoData(false); }}
                  className={`px-2.5 py-4 transition-colors ${mode === opt.value ? 'text-accent bg-dark-600' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={!query.trim() || noData || suggestions.length === 0}
            className="bg-accent hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-4 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </form>

      <p className="text-xs text-slate-500 mt-1.5 ml-1">{currentMode.hint}</p>

      {showDrop && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl overflow-hidden z-50">
          {noData ? (
            <div className="px-4 py-6 text-center">
              <FolderX className="w-7 h-7 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-300 text-sm font-semibold">No available data for "{query}"</p>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed max-w-xs mx-auto">
                This search only looks through your connected files and data sources.
                Upload your {mode === 'people' ? 'employee directory' : mode === 'vendors' ? 'vendor list' : mode === 'branches' ? 'org chart' : 'event logs'} to find matches.
              </p>
            </div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={`${s.name}-${i}`}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-dark-600 last:border-0 ${activeIdx === i ? 'bg-dark-600' : 'hover:bg-dark-600'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  mode === 'people'   ? 'bg-yellow-950 text-yellow-400' :
                  mode === 'vendors'  ? 'bg-blue-950 text-blue-400' :
                  mode === 'events'   ? 'bg-red-950 text-red-400' :
                                        'bg-purple-950 text-purple-400'
                }`}>
                  {mode === 'people' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{s.name}</p>
                  {s.detail && <p className="text-slate-500 text-xs mt-0.5 truncate">{s.detail}</p>}
                  <p className="text-slate-600 text-xs mt-0.5 italic truncate">from {s.source}</p>
                </div>
                <Database className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-1" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
