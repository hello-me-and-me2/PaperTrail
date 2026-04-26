import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Building2, User, Landmark, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { search } from '../services/api';
import { SearchType } from '../types';

const typeOptions: { value: SearchType; label: string; icon: typeof Search }[] = [
  { value: 'all', label: 'All', icon: Search },
  { value: 'recipient', label: 'Company', icon: Building2 },
  { value: 'agency', label: 'Agency', icon: Landmark },
  { value: 'person', label: 'Person', icon: User },
];

interface Suggestion {
  label: string;
  type: SearchType;
  sub: string;
  amount?: number;
}

function formatMoney(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchType>('all');
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
      const res = await search(q);
      const suggs: Suggestion[] = [];
      for (const r of res.recipients.slice(0, 4)) {
        suggs.push({ label: r.name, type: 'recipient', sub: r.topAgency || 'Federal Contractor', amount: r.totalAmount });
      }
      for (const a of res.agencies.slice(0, 3)) {
        suggs.push({ label: a.name, type: 'agency', sub: 'Government Agency', amount: a.totalAmount });
      }
      setSuggestions(suggs);
      setShowDrop(suggs.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    const resolvedType = type === 'all' ? 'recipient' : type;
    navigate(`/analysis/${resolvedType}/${encodeURIComponent(query.trim())}`);
    setShowDrop(false);
  }

  function handleSelect(s: Suggestion) {
    setQuery(s.label);
    setType(s.type);
    setShowDrop(false);
    navigate(`/analysis/${s.type}/${encodeURIComponent(s.label)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDrop) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]); }
    else if (e.key === 'Escape') setShowDrop(false);
  }

  const typeIcons = { all: Search, recipient: Building2, agency: Landmark, person: User };
  const TypeIcon = typeIcons[type];

  return (
    <div className="relative w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-dark-700 border-2 border-dark-500 focus-within:border-accent rounded-xl transition-colors overflow-hidden shadow-2xl">
          <div className="pl-4 pr-2 flex items-center">
            {loading ? (
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
            ) : (
              <TypeIcon className="w-5 h-5 text-slate-500" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowDrop(true)}
            placeholder="Search agencies, companies, people…"
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
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`px-3 py-4 text-xs font-medium transition-colors ${
                  type === opt.value
                    ? 'text-accent bg-dark-600'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!query.trim()}
            className="bg-accent hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-4 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </form>

      {showDrop && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl overflow-hidden z-50 fade-in">
          {suggestions.map((s, i) => {
            const Icon = typeIcons[s.type];
            return (
              <button
                key={`${s.label}-${i}`}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeIdx === i ? 'bg-dark-600' : 'hover:bg-dark-600'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  s.type === 'agency' ? 'bg-purple-950 text-purple-400' :
                  s.type === 'recipient' ? 'bg-blue-950 text-blue-400' :
                  'bg-yellow-950 text-yellow-400'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{s.label}</p>
                  <p className="text-slate-500 text-xs truncate">{s.sub}</p>
                </div>
                {s.amount != null && s.amount > 0 && (
                  <span className="text-xs mono text-slate-400 shrink-0">
                    {formatMoney(s.amount)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
