import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield, TrendingUp, FileSearch, AlertTriangle, Lock,
  Building2, Landmark, Users, Crosshair, BarChart3, ArrowRight,
  Sparkles, Upload, CheckCircle2, X, Loader2, ChevronDown, ChevronUp,
  FileText, DollarSign, FileSpreadsheet, Receipt, MessageSquare,
  Database, ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../contexts/AuthContext';
import { OrgSurvey } from '../types';
import { uploadOrgFile, listOrgFiles } from '../services/api';

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
    color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100',
  },
  {
    icon: AlertTriangle,
    title: 'AI Corruption Analysis',
    desc: 'Claude Opus 4.7 synthesizes your internal data with public debarment lists, news investigations, and court records to surface patterns humans miss.',
    color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100',
  },
  {
    icon: Shield,
    title: 'Multi-Source Verification',
    desc: 'Every finding is cross-referenced across your connected files and data sources — confidence scores reflect pattern strength and data corroboration.',
    color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100',
  },
  {
    icon: BarChart3,
    title: 'Audit-Ready Reports',
    desc: 'Structured risk reports with responsible parties, evidence chains, and severity ratings — formatted for compliance officers, auditors, and legal teams.',
    color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100',
  },
];

const WHO = [
  { icon: Building2, label: 'Corporations & Enterprises', desc: 'Detect vendor fraud, procurement irregularities, and expense abuse before external audits surface them.' },
  { icon: Landmark,  label: 'Government Agencies',        desc: 'Monitor grant recipients, contractor compliance, and internal spending anomalies in real time.' },
  { icon: Users,     label: 'Law Firms & Auditors',       desc: 'AI-accelerated forensic accounting — analyze years of records in minutes, not months.' },
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


const ORG_TYPE_LABELS: Record<string, string> = {
  government_agency: 'Government Agency', organization: 'Organization', company: 'Company',
};

interface Rec {
  id: string;
  label: string;
  hint: string;
  icon: typeof FileText;
  priority: 'high' | 'medium';
}

function buildRecommendations(orgType: string, survey: OrgSurvey | null): Rec[] {
  const recs: Rec[] = [];
  const risks = survey?.riskAreas ?? [];
  const industry = survey?.industry ?? '';
  const isGov = orgType === 'government_agency';

  // Always recommend
  recs.push({ id: 'vendor_list',          label: 'Vendor & Supplier List',          hint: 'Names, contract amounts, categories, and dates — critical for detecting kickbacks.',              icon: Building2,       priority: 'high' });
  recs.push({ id: 'financial_ledger',     label: 'Financial Transactions / Ledger', hint: 'Transaction dates, amounts, accounts, and payees — the foundation of fraud detection.',         icon: DollarSign,      priority: 'high' });

  // Risk-driven
  if (risks.includes('expense_abuse')) {
    recs.push({ id: 'expense_reports',    label: 'Expense Reports',                 hint: 'Submitter, amount, category, approver — detects abuse and policy violations.',                   icon: Receipt,         priority: 'high' });
  }
  if (risks.includes('procurement') || risks.includes('bid_rigging')) {
    recs.push({ id: 'contract_records',   label: 'Contract Records',                hint: 'Contract IDs, parties, values, dates, and type of award — flags irregularities.',                icon: FileSpreadsheet, priority: 'high' });
  }
  if (risks.includes('payroll_fraud')) {
    recs.push({ id: 'employee_directory', label: 'Employee / Personnel Directory',  hint: 'Names, roles, departments, hire dates — enables ghost-employee detection.',                      icon: Users,           priority: 'high' });
  }
  if (risks.includes('conflicts')) {
    recs.push({ id: 'org_chart',          label: 'Org Chart / Reporting Structure', hint: 'Who reports to whom — maps conflicts of interest and undue influence.',                          icon: FileText,        priority: 'medium' });
  }
  if (risks.includes('grant_misuse') || isGov) {
    recs.push({ id: 'grant_records',      label: 'Grant Awards & Tracking',         hint: 'Grant IDs, recipients, amounts, conditions — detects misappropriation.',                        icon: DollarSign,      priority: 'high' });
  }

  // Org type
  if (isGov) {
    recs.push({ id: 'budget_docs',        label: 'Annual Budget Documents',         hint: 'Approved allocations vs. actuals — surfaces unauthorized spending.',                             icon: FileSpreadsheet, priority: 'medium' });
  }

  // Industry-driven
  if (industry.toLowerCase().includes('healthcare')) {
    recs.push({ id: 'billing_records',    label: 'Billing & Claims Records',        hint: 'Insurance claims, procedure codes, billing amounts — detects upcoding and fraud.',               icon: Receipt,         priority: 'high' });
  }
  if (industry.toLowerCase().includes('construction')) {
    recs.push({ id: 'change_orders',      label: 'Change Orders & Subcontracts',    hint: 'Change order log and subcontractor agreements — common vector for bid rigging.',                 icon: FileSpreadsheet, priority: 'high' });
  }
  if (industry.toLowerCase().includes('defense') || industry.toLowerCase().includes('aerospace')) {
    recs.push({ id: 'far_compliance',     label: 'FAR Compliance Records',          hint: 'Federal Acquisition Regulation compliance documentation.',                                        icon: FileText,        priority: 'medium' });
  }

  // Always add meeting minutes
  recs.push({ id: 'meeting_minutes',      label: 'Meeting Minutes / Communications', hint: 'Dates, attendees, decisions — surfaces informal agreements that bypass oversight.',             icon: MessageSquare,   priority: 'medium' });

  // Deduplicate by id
  const seen = new Set<string>();
  return recs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

interface UploadedFile {
  id: number;
  original_name: string;
  file_type: string;
  file_size: number | null;
  uploaded_at: string;
}

function fmtSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function RecommendationsPanel({ orgName, orgType, survey }: { orgName: string; orgType: string; survey: OrgSurvey | null }) {
  const [open, setOpen] = useState(true);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetRec, setTargetRec] = useState<string | null>(null);

  useEffect(() => {
    listOrgFiles().then(setFiles).catch(() => {});
  }, []);

  const recs = buildRecommendations(orgType, survey);
  const connectedIds = new Set(files.map(f => f.original_name.toLowerCase()));
  const connected = recs.filter(r => connectedIds.has(r.label.toLowerCase()) || Array.from(connectedIds).some(n => n.includes(r.id.replace(/_/g, '').slice(0, 6))));
  const pending = recs.filter(r => !connected.includes(r));

  async function handleFileSelected(recId: string, selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setUploadErr('');
    setUploading(recId);
    try {
      for (const file of Array.from(selected)) {
        const result = await uploadOrgFile(file);
        setFiles(prev => [{
          id: result.id,
          original_name: result.originalName,
          file_type: result.fileType,
          file_size: result.fileSize,
          uploaded_at: new Date().toISOString(),
        }, ...prev]);
      }
    } catch {
      setUploadErr('Upload failed — only .csv, .txt, .json, .tsv files are accepted.');
    } finally {
      setUploading(null);
      setTargetRec(null);
    }
  }

  return (
    <div className="bg-white/80 border border-blue-100 rounded-2xl shadow-sm overflow-hidden mb-8">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-blue-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Recommended Data for {orgName}</p>
            <p className="text-xs text-slate-500">
              {connected.length}/{recs.length} data sources connected · AI-tailored to your profile
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium rounded-full px-2 py-0.5">
              {pending.length} recommended
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-6 py-4">
          {uploadErr && (
            <p className="text-xs text-red-500 mb-3">{uploadErr}</p>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.txt,.json,.tsv"
            className="hidden"
            onChange={(e) => handleFileSelected(targetRec ?? '', e.target.files)}
          />

          <div className="space-y-2">
            {recs.map((rec) => {
              const Icon = rec.icon;
              const isConnected = connected.includes(rec);
              const isUploading = uploading === rec.id;

              return (
                <div
                  key={rec.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    isConnected
                      ? 'border-green-200 bg-green-50'
                      : rec.priority === 'high'
                        ? 'border-amber-200 bg-amber-50/60'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                    isConnected ? 'bg-green-100' : 'bg-white border border-slate-200'
                  }`}>
                    {isConnected
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <Icon className="w-3.5 h-3.5 text-slate-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-slate-800">{rec.label}</p>
                      {!isConnected && rec.priority === 'high' && (
                        <span className="text-xs bg-amber-200 text-amber-800 rounded-full px-1.5 py-0.5 font-medium">High Impact</span>
                      )}
                      {isConnected && (
                        <span className="text-xs bg-green-100 text-green-700 rounded-full px-1.5 py-0.5">Connected</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{rec.hint}</p>
                  </div>
                  {!isConnected && (
                    <button
                      onClick={() => { setTargetRec(rec.id); setTimeout(() => fileInputRef.current?.click(), 10); }}
                      disabled={isUploading}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-accent hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {isUploading
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                        : <><Upload className="w-3 h-3" /> Add</>
                      }
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {files.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">All Uploaded Files</p>
              <div className="space-y-1.5">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span className="truncate flex-1">{f.original_name}</span>
                    <span className="text-slate-400 shrink-0">{fmtSize(f.file_size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Recommendations are tailored to your business profile. <Link to="/data-setup" className="text-accent hover:underline">Upload more files →</Link>
            </p>
            {pending.length === 0 && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> All connected
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const orgName = user?.orgDisplayName ?? user?.orgName ?? '';
  const orgType = user?.orgType ?? '';
  const searchSectionRef = useRef<HTMLDivElement>(null);

  const handleAnalyzeClick = useCallback(() => {
    searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      searchSectionRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }, 400);
  }, []);

  return (
    <div className="min-h-screen" style={PAPER_BG}>
      {/* ── Hero ── */}
      <div className="relative">
        {/* Decorative trail — clipped independently so it doesn't affect dropdown overflow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <svg
          viewBox="0 0 200 185"
          className="absolute bottom-0 right-4 sm:right-14 w-32 sm:w-44 opacity-[0.19]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M 30 175 C 40 155 25 132 55 117 S 82 90 92 74 S 122 52 142 37 S 168 20 178 10"
            fill="none" stroke="#6b4f2a" strokeWidth="2.5" strokeDasharray="6,5" strokeLinecap="round" />
          {TRAIL_DOTS.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.5" fill="#6b4f2a" />
          ))}
          <circle cx="30" cy="175" r="5" fill="none" stroke="#6b4f2a" strokeWidth="2" />
          <path d="M178 4 L180 9 L185 9 L181 13 L183 18 L178 15 L173 18 L175 13 L171 9 L176 9 Z" fill="#6b4f2a" opacity="0.7" />
          {GRASS_TUFTS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5a7a3a" strokeWidth="1.5" strokeLinecap="round" />
          ))}
        </svg>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
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

          {orgName && (
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <button
                onClick={handleAnalyzeClick}
                className="flex items-center gap-2 bg-accent hover:bg-blue-600 text-white font-semibold px-5 py-3 rounded-xl transition-colors shadow-sm text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                Analyze {orgName}
              </button>
              <Link
                to="/investigate"
                className="flex items-center gap-2 bg-white/70 hover:bg-white border border-slate-200 hover:border-accent/40 text-slate-700 hover:text-accent text-sm font-medium px-5 py-3 rounded-xl transition-all shadow-sm"
              >
                <Crosshair className="w-4 h-4 text-accent" />
                Investigate {orgName} Network
              </Link>
            </div>
          )}

          <p className="text-xs text-slate-500 mb-2">
            {orgName ? 'Or search a specific vendor, contractor, or person in your data:' : 'Search a vendor, contractor, or entity:'}
          </p>
          <div ref={searchSectionRef} className="flex justify-center mb-4">
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

      <div className="max-w-5xl mx-auto px-4 pb-16">
        {/* ── Recommended Data Panel (org users only) ── */}
        {orgName && user?.orgSurvey !== undefined && (
          <RecommendationsPanel
            orgName={orgName}
            orgType={orgType}
            survey={user.orgSurvey}
          />
        )}

        {/* ── Feature cards ── */}
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
          <h2 className="text-center text-xl font-bold text-slate-800 mb-2">Built for Organizations That Need Answers</h2>
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
              { step: '1', title: 'Connect Your Data',    desc: 'Securely provide payment records, vendor lists, ERP exports, and business logs for AI analysis.' },
              { step: '2', title: 'AI Scans Everything',  desc: 'Claude Opus 4.7 cross-references your data against public debarment lists, news investigations, and court records simultaneously.' },
              { step: '3', title: 'Receive Risk Reports', desc: 'Prioritized findings with responsible parties, flagged transactions, and evidence chains — ready for auditors and legal teams.' },
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
            <strong className="text-slate-500">Disclaimer:</strong> Risk scores reflect objective pattern analysis using public and provided data. A high score indicates anomalous patterns, not proven wrongdoing. Consult official IG reports or legal counsel for final determinations.
          </p>
        </div>
      </div>
    </div>
  );
}
