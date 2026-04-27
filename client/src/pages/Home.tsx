import { Shield, TrendingUp, FileSearch, AlertTriangle, ExternalLink, Crosshair } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';

const EXAMPLES = [
  { label: 'Lockheed Martin', type: 'recipient' as const },
  { label: 'Boeing', type: 'recipient' as const },
  { label: 'Raytheon', type: 'recipient' as const },
  { label: 'Department of Defense', type: 'agency' as const },
  { label: 'Booz Allen Hamilton', type: 'recipient' as const },
  { label: 'SAIC', type: 'recipient' as const },
];

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Search Federal Spending',
    desc: 'Search any company, government agency, or keyword against the full federal contracts and grants database.',
    color: 'text-blue-400',
    bg: 'bg-blue-950',
  },
  {
    icon: AlertTriangle,
    title: 'Risk Analysis',
    desc: 'Automated scoring of no-bid contracts, award concentration, single-offer bids, and anomalous spending patterns.',
    color: 'text-red-400',
    bg: 'bg-red-950',
  },
  {
    icon: Shield,
    title: 'Evidence-Backed',
    desc: 'Every finding is backed by specific contract records linked directly to USASpending.gov official government data.',
    color: 'text-green-400',
    bg: 'bg-green-950',
  },
  {
    icon: TrendingUp,
    title: 'Historical Trends',
    desc: 'See spending trends over time to identify sudden spikes or suspicious patterns in award history.',
    color: 'text-purple-400',
    bg: 'bg-purple-950',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-dark-900">
      <div className="relative overflow-hidden">
        {/* Supreme Court background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=1920&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
        {/* Dark gradient overlay so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900/80 via-dark-900/70 to-dark-900" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-dark-700 border border-dark-500 rounded-full px-3 py-1.5 text-xs text-slate-400 mb-6">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live data from USASpending.gov — Official U.S. Federal Spending
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-4 tracking-tight leading-tight">
            Follow the{' '}
            <span className="text-accent">PaperTrail</span>
          </h1>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Analyze federal government spending to surface no-bid contracts, award concentration, and
            patterns of potential mismanagement — all backed by official public records.
          </p>

          <div className="flex justify-center mb-4">
            <SearchBar autoFocus />
          </div>

          <div className="flex justify-center mb-6">
            <Link
              to="/investigate"
              className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-accent/50 text-slate-300 hover:text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
            >
              <Crosshair className="w-4 h-4 text-accent" />
              Investigate multiple targets simultaneously
              <span className="text-xs bg-accent/20 text-accent rounded-full px-2 py-0.5">AI</span>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <span className="text-xs text-slate-600">Try:</span>
            {EXAMPLES.map((ex) => (
              <a
                key={ex.label}
                href={`/analysis/${ex.type}/${encodeURIComponent(ex.label)}`}
                className="text-xs text-slate-500 hover:text-accent transition-colors border border-dark-500 hover:border-accent/40 rounded-full px-3 py-1"
              >
                {ex.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card p-5">
                <div className={`w-9 h-9 rounded-lg ${f.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4.5 h-4.5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-1.5 text-sm">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="card p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-white mb-1">How Risk Scores Work</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                PaperTrail analyzes publicly available federal spending data and applies objective criteria to generate risk scores.
                A high score does <strong className="text-white">not</strong> constitute proof of illegal activity — it flags patterns
                that warrant scrutiny by oversight authorities, journalists, and the public.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { level: 'CRITICAL', cls: 'bg-red-950 text-red-400 border-red-800', desc: '75–100: Severe red flags' },
                  { level: 'HIGH',     cls: 'bg-orange-950 text-orange-400 border-orange-800', desc: '50–74: Significant concerns' },
                  { level: 'MODERATE', cls: 'bg-yellow-950 text-yellow-400 border-yellow-800', desc: '25–49: Some irregularities' },
                  { level: 'LOW',      cls: 'bg-green-950 text-green-400 border-green-800', desc: '0–24: Few anomalies' },
                ].map((r) => (
                  <div key={r.level} className={`border rounded-lg p-2.5 ${r.cls}`}>
                    <p className="font-mono font-bold mb-0.5">{r.level}</p>
                    <p className="opacity-70">{r.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <ExternalLink className="w-3 h-3" />
                <span>All data sourced from </span>
                <a href="https://www.usaspending.gov" target="_blank" rel="noopener noreferrer"
                  className="text-accent hover:underline">usaspending.gov</a>
                <span>— Official U.S. government open data portal.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
