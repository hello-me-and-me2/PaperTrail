import { Shield, TrendingUp, FileSearch, AlertTriangle, Lock, Building2, Landmark, Users, Crosshair, BarChart3, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../contexts/AuthContext';

const TRAIL_DOTS: [number, number][] = [
  [38, 158], [50, 138], [62, 120], [76, 103], [90, 88],
  [106, 72], [122, 57], [140, 43], [158, 28],
];

const GRASS_TUFTS: [number, number, number, number][] = [
  [44, 150, 44, 143], [48, 152, 52, 145],
  [74, 110, 72, 103], [78, 111, 82, 104],
  [108, 78, 106, 71], [112, 79, 116, 72],
];

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Connect Any Data Source',
    desc: 'Link payment systems, ERP exports, procurement records, expense reports, and vendor contracts. AI works across structured and unstructured formats.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    icon: AlertTriangle,
    title: 'AI Corruption Analysis',
    desc: 'Claude Opus 4.7 synthesizes your internal data with public debarment lists, news investigations, and court records to surface patterns humans miss.',
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
  },
  {
    icon: Shield,
    title: 'Multi-Source Verification',
    desc: 'Every finding is cross-referenced across internal records, USASpending.gov, Federal Register, and live news — confidence scores show agreement across sources.',
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-100',
  },
  {
    icon: BarChart3,
    title: 'Audit-Ready Reports',
    desc: 'Structured risk reports with responsible parties, evidence chains, and severity ratings — formatted for compliance officers, auditors, and legal teams.',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
];

const WHO = [
  {
    icon: Building2,
    label: 'Corporations & Enterprises',
    desc: 'Detect vendor fraud, procurement irregularities, and expense abuse before external audits surface them.',
  },
  {
    icon: Landmark,
    label: 'Government Agencies',
    desc: 'Monitor grant recipients, contractor compliance, and internal spending anomalies in real time.',
  },
  {
    icon: Users,
    label: 'Law Firms & Auditors',
    desc: 'AI-accelerated forensic accounting — analyze years of records in minutes, not months.',
  },
];

const PAPER_BG: React.CSSProperties = {
  backgroundColor: '#fdf8ef',
  backgroundImage: [
    'radial-gradient(ellipse 90% 55% at 22% 20%, rgba(255,255,255,0.42) 0%, transparent 70%)',
    'radial-gradient(ellipse 60% 45% at 78% 68%, rgba(0,0,0,0.022) 0%, transparent 70%)',
    'radial-gradient(ellipse 45% 35% at 8% 82%, rgba(255,255,255,0.28) 0%, transparent 60%)',
    'radial-gradient(ellipse 40% 30% at 92% 12%, rgba(0,0,0,0.018) 0%, transparent 60%)',
    'linear-gradient(90deg, transparent 70px, rgba(244,164,164,0.5) 70px, rgba(244,164,164,0.5) 72px, transparent 72px)',
    'repeating-linear-gradient(180deg, transparent 0, transparent 27px, rgba(180,210,245,0.62) 27px, rgba(180,210,245,0.62) 28.5px)',
  ].join(', '),
};

const ORG_TYPE_ANALYSIS: Record<string, 'recipient' | 'agency' | 'person'> = {
  government_agency: 'agency',
  organization: 'recipient',
  company: 'recipient',
};

const ORG_TYPE_LABELS: Record<string, string> = {
  government_agency: 'Government Agency',
  organization: 'Organization',
  company: 'Company',
};

export default function Home() {
  const { user } = useAuth();
  const orgName = user?.orgDisplayName ?? user?.orgName ?? '';
  const orgType = user?.orgType ?? '';
  const analysisType = ORG_TYPE_ANALYSIS[orgType] ?? 'recipient';

  return (
    <div className="min-h-screen" style={PAPER_BG}>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        {/* Hand-drawn trail doodle — bottom-right corner of hero */}
        <svg
          viewBox="0 0 200 185"
          className="absolute bottom-0 right-4 sm:right-14 w-32 sm:w-44 opacity-[0.19] pointer-events-none select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 30 175 C 40 155 25 132 55 117 S 82 90 92 74 S 122 52 142 37 S 168 20 178 10"
            fill="none"
            stroke="#6b4f2a"
            strokeWidth="2.5"
            strokeDasharray="6,5"
            strokeLinecap="round"
          />
          {TRAIL_DOTS.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.5" fill="#6b4f2a" />
          ))}
          <circle cx="30" cy="175" r="5" fill="none" stroke="#6b4f2a" strokeWidth="2" />
          <path
            d="M178 4 L180 9 L185 9 L181 13 L183 18 L178 15 L173 18 L175 13 L171 9 L176 9 Z"
            fill="#6b4f2a"
            opacity="0.7"
          />
          {GRASS_TUFTS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5a7a3a" strokeWidth="1.5" strokeLinecap="round" />
          ))}
        </svg>

        <div className="relative max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
          {/* Org badge */}
          <div className="inline-flex items-center gap-2 bg-white/70 border border-blue-100 rounded-full px-3 py-1.5 text-xs text-slate-600 mb-6 shadow-sm">
            <Lock className="w-3 h-3 text-blue-500" />
            {orgType ? ORG_TYPE_LABELS[orgType] : 'Enterprise'} · Private · AI-Powered
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
            {orgName ? (
              <>Corruption Monitor for<br /><span className="text-accent">{orgName}</span></>
            ) : (
              <>Detect Corruption.<br />Follow the <span className="text-accent">PaperTrail.</span></>
            )}
          </h1>

          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            {orgName
              ? `AI is scanning vendors, contractors, and financial patterns associated with ${orgName} for signs of corruption, fraud, and mismanagement.`
              : 'AI-powered internal corruption detection. Connect your payment records, vendor contracts, and business logs — our AI finds fraud patterns before they become scandals.'
            }
          </p>

          {/* Primary CTAs when org is set */}
          {orgName && (
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <Link
                to={`/analysis/${analysisType}/${encodeURIComponent(orgName)}`}
                className="flex items-center gap-2 bg-accent hover:bg-blue-600 text-white font-semibold px-5 py-3 rounded-xl transition-colors shadow-sm text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                Analyze {orgName}
              </Link>
              <Link
                to="/investigate"
                className="flex items-center gap-2 bg-white/70 hover:bg-white border border-slate-200 hover:border-accent/40 text-slate-700 hover:text-accent text-sm font-medium px-5 py-3 rounded-xl transition-all shadow-sm"
              >
                <Crosshair className="w-4 h-4 text-accent" />
                Investigate {orgName} Network
              </Link>
            </div>
          )}

          {/* Search for specific vendors/contractors */}
          <p className="text-xs text-slate-500 mb-2">
            {orgName ? 'Or search a specific vendor, contractor, or person:' : 'Search a vendor, contractor, or entity:'}
          </p>
          <div className="flex justify-center mb-4">
            <SearchBar autoFocus={!orgName} />
          </div>

          {!orgName && (
            <div className="flex justify-center">
              <Link
                to="/investigate"
                className="flex items-center gap-2 bg-white/70 hover:bg-white border border-slate-200 hover:border-accent/40 text-slate-700 hover:text-accent text-sm font-medium px-5 py-2.5 rounded-xl transition-all shadow-sm"
              >
                <Crosshair className="w-4 h-4 text-accent" />
                Multi-target investigation
                <span className="text-xs bg-accent/10 text-accent rounded-full px-2 py-0.5">AI</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Feature cards ── */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className={`bg-white/80 border ${f.border} rounded-xl p-5 shadow-sm`}>
                <div className={`w-9 h-9 rounded-lg ${f.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4.5 h-4.5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-slate-800 mb-1.5 text-sm">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* ── Who uses it ── */}
        <div className="mb-16">
          <h2 className="text-center text-xl font-bold text-slate-800 mb-2">
            Built for Organizations That Need Answers
          </h2>
          <p className="text-center text-sm text-slate-500 mb-8">
            PaperTrail contracts with organizations to provide private, AI-powered corruption detection on their own data.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {WHO.map((w) => {
              const Icon = w.icon;
              return (
                <div key={w.label} className="bg-white/70 border border-slate-200 rounded-xl p-5 shadow-sm text-center">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1 text-sm">{w.label}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{w.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── How it works + risk levels ── */}
        <div className="bg-white/70 border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            How Risk Analysis Works
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            {[
              {
                step: '1',
                title: 'Connect Your Data',
                desc: 'Securely provide payment records, vendor lists, ERP exports, and business logs for AI analysis.',
              },
              {
                step: '2',
                title: 'AI Scans Everything',
                desc: 'Claude Opus 4.7 cross-references your data against public debarment lists, news investigations, and court records simultaneously.',
              },
              {
                step: '3',
                title: 'Receive Risk Reports',
                desc: 'Prioritized findings with responsible parties, flagged transactions, and evidence chains — ready for auditors and legal teams.',
              },
            ].map((s) => (
              <div key={s.step} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { level: 'CRITICAL', cls: 'bg-red-50 text-red-600 border-red-200',          desc: '75–100: Severe red flags' },
              { level: 'HIGH',     cls: 'bg-orange-50 text-orange-600 border-orange-200', desc: '50–74: Significant concerns' },
              { level: 'MODERATE', cls: 'bg-yellow-50 text-yellow-600 border-yellow-200', desc: '25–49: Some irregularities' },
              { level: 'LOW',      cls: 'bg-green-50 text-green-600 border-green-200',    desc: '0–24: Few anomalies' },
            ].map((r) => (
              <div key={r.level} className={`border rounded-lg p-2.5 ${r.cls}`}>
                <p className="font-mono font-bold mb-0.5">{r.level}</p>
                <p className="opacity-70">{r.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-4 leading-relaxed">
            <strong className="text-slate-500">Disclaimer:</strong> Risk scores reflect objective pattern analysis using public and provided data.
            A high score indicates anomalous patterns, not proven wrongdoing. Consult official IG reports or legal counsel for final determinations.
          </p>
        </div>
      </div>
    </div>
  );
}
