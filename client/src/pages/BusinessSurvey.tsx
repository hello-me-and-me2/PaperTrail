import { useState } from 'react';
import {
  FileText, ChevronLeft, ChevronRight, CheckCircle2, Loader2,
  Users, DollarSign, Globe, Building2, Truck, Shield, BookOpen,
  AlertTriangle, Server, CreditCard, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { OrgSurvey } from '../types';

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

type Step = 0 | 1 | 2 | 3;

interface RadioGroupProps {
  options: { value: string; label: string; desc?: string }[];
  value: string;
  onChange: (v: string) => void;
}

function RadioGroup({ options, value, onChange }: RadioGroupProps) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
            value === o.value
              ? 'border-accent bg-blue-50 shadow-sm'
              : 'border-slate-200 bg-white hover:border-accent/40 hover:bg-slate-50'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
            value === o.value ? 'border-accent' : 'border-slate-300'
          }`}>
            {value === o.value && <div className="w-2 h-2 rounded-full bg-accent" />}
          </div>
          <div>
            <p className={`text-sm font-medium ${value === o.value ? 'text-accent' : 'text-slate-800'}`}>{o.label}</p>
            {o.desc && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{o.desc}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

interface CheckGroupProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}

function CheckGroup({ options, value, onChange, max }: CheckGroupProps) {
  function toggle(v: string) {
    if (value.includes(v)) {
      onChange(value.filter(x => x !== v));
    } else {
      if (max && value.length >= max) return;
      onChange([...value, v]);
    }
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((o) => {
        const checked = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
              checked
                ? 'border-accent bg-blue-50'
                : 'border-slate-200 bg-white hover:border-accent/40 hover:bg-slate-50'
            }`}
          >
            <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
              checked ? 'border-accent bg-accent' : 'border-slate-300'
            }`}>
              {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <span className={`text-xs font-medium ${checked ? 'text-accent' : 'text-slate-700'}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const STEPS: { title: string; subtitle: string; icon: typeof Users }[] = [
  { title: 'Organization Profile',  subtitle: 'Size, budget, and geographic reach',      icon: Building2 },
  { title: 'Industry & Operations', subtitle: 'Your sector and vendor relationships',     icon: Truck      },
  { title: 'Risk & Compliance',     subtitle: 'Vulnerabilities and regulatory exposure',  icon: Shield     },
  { title: 'Data & Systems',        subtitle: 'How your organization manages information', icon: Server     },
];

export default function BusinessSurvey() {
  const { user, completeSurvey } = useAuth();
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 0
  const [employeeCount, setEmployeeCount] = useState('');
  const [annualBudget, setAnnualBudget] = useState('');
  const [geographicScope, setGeographicScope] = useState('');

  // Step 1
  const [industry, setIndustry] = useState('');
  const [vendorCount, setVendorCount] = useState('');

  // Step 2
  const [riskAreas, setRiskAreas] = useState<string[]>([]);
  const [regulatoryFrameworks, setRegulatoryFrameworks] = useState<string[]>([]);
  const [auditTeam, setAuditTeam] = useState('');

  // Step 3
  const [dataSystems, setDataSystems] = useState<string[]>([]);
  const [paymentTracking, setPaymentTracking] = useState('');

  function canAdvance() {
    if (step === 0) return !!employeeCount && !!annualBudget && !!geographicScope;
    if (step === 1) return !!industry && !!vendorCount;
    if (step === 2) return riskAreas.length > 0 && !!auditTeam;
    if (step === 3) return dataSystems.length > 0 && !!paymentTracking;
    return false;
  }

  async function handleSubmit() {
    setSaving(true);
    setError('');
    const survey: OrgSurvey = {
      employeeCount, annualBudget, geographicScope,
      industry, vendorCount,
      riskAreas, regulatoryFrameworks, auditTeam,
      dataSystems, paymentTracking,
    };
    try {
      await completeSurvey(survey);
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  const orgName = user?.orgDisplayName ?? user?.orgName ?? 'your organization';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={PAPER_BG}>
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">
            Paper<span className="text-accent">Trail</span>
          </span>
        </div>

        {/* Global stage indicator */}
        <div className="flex items-center justify-center gap-1 mb-8 text-xs">
          {['Org Setup', 'Business Profile', 'Connect Data'].map((label, i) => {
            const done = i === 0;
            const active = i === 1;
            return (
              <span key={label} className="flex items-center gap-1">
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${
                  done   ? 'bg-green-100 text-green-700' :
                  active ? 'bg-accent text-white' :
                           'bg-slate-100 text-slate-400'
                }`}>
                  {done ? <CheckCircle2 className="w-3 h-3" /> : null}
                  {label}
                </span>
                {i < 2 && <ChevronRight className="w-3 h-3 text-slate-300" />}
              </span>
            );
          })}
        </div>

        <div className="bg-white/85 border border-slate-200 rounded-2xl p-8 shadow-sm">
          {/* Step progress dots */}
          <div className="flex items-center gap-1 mb-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex items-center gap-1">
                  <div className={`flex items-center justify-center rounded-full transition-all ${
                    i < step  ? 'w-7 h-7 bg-green-500 text-white' :
                    i === step ? 'w-7 h-7 bg-accent text-white' :
                                 'w-5 h-5 bg-slate-200 text-slate-400'
                  }`}>
                    {i < step
                      ? <CheckCircle2 className="w-4 h-4" />
                      : <Icon className={`${i === step ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} />
                    }
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-0.5 w-8 rounded transition-colors ${i < step ? 'bg-green-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-0.5">{STEPS[step].title}</h1>
          <p className="text-sm text-slate-500 mb-6">{STEPS[step].subtitle}</p>

          {/* ── Step 0: Org Profile ── */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  How many people work at {orgName}?
                </label>
                <RadioGroup
                  value={employeeCount}
                  onChange={setEmployeeCount}
                  options={[
                    { value: 'under_50',    label: 'Under 50',       desc: 'Small team or startup' },
                    { value: '50_500',      label: '50 – 500',        desc: 'Mid-size organization' },
                    { value: '500_5000',    label: '500 – 5,000',     desc: 'Large organization' },
                    { value: 'over_5000',   label: 'Over 5,000',      desc: 'Enterprise / institution' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-accent" />
                  Annual operating budget or revenue
                </label>
                <RadioGroup
                  value={annualBudget}
                  onChange={setAnnualBudget}
                  options={[
                    { value: 'under_1m',    label: 'Under $1 million' },
                    { value: '1m_25m',      label: '$1M – $25M' },
                    { value: '25m_250m',    label: '$25M – $250M' },
                    { value: 'over_250m',   label: 'Over $250 million' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Globe className="w-3.5 h-3.5 text-accent" />
                  Geographic scope of operations
                </label>
                <RadioGroup
                  value={geographicScope}
                  onChange={setGeographicScope}
                  options={[
                    { value: 'local',        label: 'Local / Municipal',          desc: 'City or county level' },
                    { value: 'state',        label: 'State / Regional',            desc: 'One or several states' },
                    { value: 'national',     label: 'National',                   desc: 'Operates across the country' },
                    { value: 'international',label: 'International / Multinational', desc: 'Multiple countries' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* ── Step 1: Industry & Ops ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-accent" />
                  Primary industry or sector
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Defense & Aerospace', 'Healthcare & Life Sciences', 'Technology & Software',
                    'Financial Services', 'Energy & Utilities', 'Construction & Real Estate',
                    'Logistics & Transportation', 'Education & Research', 'Retail & Consumer Goods',
                    'Non-Profit / Social Services', 'Government Administration', 'Legal & Professional Services',
                  ].map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => setIndustry(ind)}
                      className={`px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all ${
                        industry === ind
                          ? 'border-accent bg-blue-50 text-accent'
                          : 'border-slate-200 bg-white hover:border-accent/40 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Truck className="w-3.5 h-3.5 text-accent" />
                  How many vendors or suppliers do you work with?
                </label>
                <RadioGroup
                  value={vendorCount}
                  onChange={setVendorCount}
                  options={[
                    { value: 'under_50',    label: 'Fewer than 50',     desc: 'Small, trusted supplier base' },
                    { value: '50_500',      label: '50 – 500',           desc: 'Moderate supplier network' },
                    { value: '500_2000',    label: '500 – 2,000',        desc: 'Large procurement operation' },
                    { value: 'over_2000',   label: 'More than 2,000',    desc: 'Complex supply chain' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Risk & Compliance ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-accent" />
                  Primary risk concerns <span className="text-slate-400 font-normal normal-case tracking-normal">(select all that apply)</span>
                </label>
                <CheckGroup
                  value={riskAreas}
                  onChange={setRiskAreas}
                  options={[
                    { value: 'vendor_fraud',      label: 'Vendor fraud / kickbacks' },
                    { value: 'expense_abuse',     label: 'Expense account abuse' },
                    { value: 'procurement',       label: 'Procurement irregularities' },
                    { value: 'payroll_fraud',     label: 'Payroll / ghost employees' },
                    { value: 'grant_misuse',      label: 'Grant misuse / misappropriation' },
                    { value: 'conflicts',         label: 'Conflicts of interest' },
                    { value: 'bid_rigging',       label: 'Contract manipulation / bid rigging' },
                    { value: 'embezzlement',      label: 'Embezzlement / asset misappropriation' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-accent" />
                  Applicable regulatory frameworks <span className="text-slate-400 font-normal normal-case tracking-normal">(select all that apply)</span>
                </label>
                <CheckGroup
                  value={regulatoryFrameworks}
                  onChange={setRegulatoryFrameworks}
                  options={[
                    { value: 'sox',           label: 'Sarbanes-Oxley (SOX)' },
                    { value: 'fcpa',          label: 'FCPA / Anti-Bribery' },
                    { value: 'far',           label: 'Federal Acquisition (FAR)' },
                    { value: 'healthcare',    label: 'HIPAA / OIG (Healthcare)' },
                    { value: 'sec_finra',     label: 'SEC / FINRA (Finance)' },
                    { value: 'gdpr',          label: 'GDPR / Privacy laws' },
                    { value: 'none',          label: 'None / General compliance' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Shield className="w-3.5 h-3.5 text-accent" />
                  Internal audit function
                </label>
                <RadioGroup
                  value={auditTeam}
                  onChange={setAuditTeam}
                  options={[
                    { value: 'dedicated',   label: 'Yes — dedicated internal audit team' },
                    { value: 'shared',      label: 'Yes — shared / part-time audit function' },
                    { value: 'external',    label: 'No — rely on external auditors only' },
                    { value: 'none',        label: 'No audit function currently' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Data Systems ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Server className="w-3.5 h-3.5 text-accent" />
                  Financial / ERP systems in use <span className="text-slate-400 font-normal normal-case tracking-normal">(select all that apply)</span>
                </label>
                <CheckGroup
                  value={dataSystems}
                  onChange={setDataSystems}
                  options={[
                    { value: 'sap',          label: 'SAP' },
                    { value: 'oracle',       label: 'Oracle / NetSuite' },
                    { value: 'quickbooks',   label: 'QuickBooks / Xero' },
                    { value: 'dynamics',     label: 'Microsoft Dynamics' },
                    { value: 'sage',         label: 'Sage' },
                    { value: 'salesforce',   label: 'Salesforce' },
                    { value: 'custom',       label: 'Custom / Proprietary' },
                    { value: 'spreadsheets', label: 'Spreadsheets only' },
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <CreditCard className="w-3.5 h-3.5 text-accent" />
                  How do you currently track vendor payments?
                </label>
                <RadioGroup
                  value={paymentTracking}
                  onChange={setPaymentTracking}
                  options={[
                    { value: 'erp',         label: 'ERP / Integrated system',      desc: 'Payments are logged in your ERP or financial platform' },
                    { value: 'accounting',  label: 'Accounting software',           desc: 'QuickBooks, Xero, FreshBooks, etc.' },
                    { value: 'spreadsheets',label: 'Manual spreadsheets',           desc: 'Excel or Google Sheets with manual entry' },
                    { value: 'paper',       label: 'Paper-based records',           desc: 'Physical invoices and receipts' },
                  ]}
                />
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-xs text-red-500">{error}</p>}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-7">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 bg-accent hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canAdvance() || saving}
                className="flex items-center gap-2 bg-accent hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <>Finish Profile <ArrowRight className="w-4 h-4" /></>
                }
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Your answers customize which data the AI requests and how it analyzes your organization.
        </p>
      </div>
    </div>
  );
}
