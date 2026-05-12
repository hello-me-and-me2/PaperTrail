import { useState, useEffect, useRef } from 'react';
import {
  FileText, CheckCircle2, Loader2, ArrowRight, Link2, Copy, Check,
  Plug, Upload, X, ExternalLink, RefreshCw, Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getConnections, addConnection, deleteConnection, uploadOrgFile } from '../services/api';
import { OrgConnection } from '../types';

const PAPER_BG: React.CSSProperties = {
  backgroundColor: '#fdf8ef',
  backgroundImage: [
    'radial-gradient(ellipse 90% 55% at 22% 20%, rgba(255,255,255,0.42) 0%, transparent 70%)',
    'radial-gradient(ellipse 60% 45% at 78% 68%, rgba(0,0,0,0.022) 0%, transparent 70%)',
    'linear-gradient(90deg, transparent 70px, rgba(244,164,164,0.5) 70px, rgba(244,164,164,0.5) 72px, transparent 72px)',
    'repeating-linear-gradient(180deg, transparent 0, transparent 27px, rgba(180,210,245,0.62) 27px, rgba(180,210,245,0.62) 28.5px)',
  ].join(', '),
};

interface ServiceDef {
  id: string;
  name: string;
  category: string;
  description: string;
  logo: string;
  authType: 'webhook' | 'apikey' | 'oauth_soon';
  fields?: { key: string; label: string; placeholder: string }[];
}

const SERVICES: ServiceDef[] = [
  { id: 'webhook', name: 'Generic Webhook', category: 'Universal', logo: '🔗', description: 'Any service that supports webhooks — get a URL and paste it into your accounting software, ERP, or any other tool.', authType: 'webhook' },
  { id: 'quickbooks', name: 'QuickBooks Online', category: 'Accounting', logo: '💰', description: 'Connect your QuickBooks to stream invoices, vendor payments, and transactions automatically.', authType: 'apikey', fields: [{ key: 'company_id', label: 'Company ID', placeholder: 'Your QuickBooks Company ID' }, { key: 'access_token', label: 'Access Token', placeholder: 'Bearer token from QuickBooks Developer' }] },
  { id: 'xero', name: 'Xero', category: 'Accounting', logo: '📊', description: 'Sync vendor bills, bank transactions, and expense claims from Xero.', authType: 'apikey', fields: [{ key: 'tenant_id', label: 'Tenant ID', placeholder: 'Your Xero Tenant ID' }, { key: 'access_token', label: 'Access Token', placeholder: 'Xero OAuth2 access token' }] },
  { id: 'stripe', name: 'Stripe', category: 'Payments', logo: '💳', description: 'Monitor payment flows, payout patterns, and refund anomalies.', authType: 'apikey', fields: [{ key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...' }] },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', logo: '☁️', description: 'Analyze deal patterns, vendor relationships, and procurement data from Salesforce.', authType: 'oauth_soon' },
  { id: 'netsuite', name: 'Oracle NetSuite', category: 'ERP', logo: '🏢', description: 'Deep ERP integration — vendor master, purchase orders, and financial transactions.', authType: 'oauth_soon' },
  { id: 'sap', name: 'SAP', category: 'ERP', logo: '⚙️', description: 'Enterprise SAP integration for procurement, vendor, and financial data.', authType: 'webhook' },
  { id: 'adp', name: 'ADP', category: 'Payroll', logo: '👥', description: 'Payroll, headcount, and compensation data to detect ghost employees and payroll fraud.', authType: 'webhook' },
  { id: 'plaid', name: 'Plaid (Bank Feeds)', category: 'Banking', logo: '🏦', description: 'Direct bank transaction feeds for real-time cash flow monitoring.', authType: 'apikey', fields: [{ key: 'access_token', label: 'Access Token', placeholder: 'Plaid access-production-...' }] },
  { id: 'google_drive', name: 'Google Drive', category: 'Documents', logo: '📁', description: 'Monitor documents, spreadsheets, and files stored in Drive for data changes.', authType: 'oauth_soon' },
  { id: 'dropbox', name: 'Dropbox', category: 'Documents', logo: '📦', description: 'Sync business files and documents from Dropbox folders.', authType: 'oauth_soon' },
  { id: 'microsoft_365', name: 'Microsoft 365', category: 'Documents', logo: '🪟', description: 'SharePoint, OneDrive, and Teams data for complete business monitoring.', authType: 'oauth_soon' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-accent hover:text-blue-700 transition-colors shrink-0">
      {copied ? <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
    </button>
  );
}

function ServiceCard({ svc, connection, onConnect, onDelete, appUrl }: {
  svc: ServiceDef;
  connection?: OrgConnection;
  onConnect: (svc: ServiceDef, credentials: Record<string, string>) => Promise<void>;
  onDelete: (id: number) => void;
  appUrl: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const webhookUrl = connection ? `${appUrl}/api/connections/webhook/${connection.webhookToken}` : '';
  const isConnected = !!connection;

  async function handleConnect() {
    setLoading(true);
    try { await onConnect(svc, creds); setExpanded(false); }
    finally { setLoading(false); }
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isConnected ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-3 p-4">
        <span className="text-2xl shrink-0">{svc.logo}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800">{svc.name}</p>
            <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{svc.category}</span>
            {isConnected && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Live</span>}
            {svc.authType === 'oauth_soon' && <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">Coming Soon</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{svc.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <button onClick={() => onDelete(connection!.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {!isConnected && svc.authType !== 'oauth_soon' && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-xs font-semibold bg-accent hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
              <Plug className="w-3 h-3" /> Connect
            </button>
          )}
          {svc.authType === 'oauth_soon' && !isConnected && (
            <span className="text-xs text-slate-400">Coming soon</span>
          )}
        </div>
      </div>

      {/* Webhook URL display when connected */}
      {isConnected && svc.authType === 'webhook' && webhookUrl && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Your Webhook URL — paste this into {svc.name}:</p>
          <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
            <code className="text-xs text-green-400 flex-1 truncate font-mono">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Configure {svc.name} to POST data to this URL whenever records change.
            {connection.lastSyncAt && ` Last received: ${new Date(connection.lastSyncAt).toLocaleString()}`}
          </p>
        </div>
      )}

      {/* API key form when expanding */}
      {expanded && !isConnected && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
          <p className="text-xs text-slate-500 mb-3">{svc.description}</p>
          {svc.fields?.map(f => (
            <div key={f.key} className="mb-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">{f.label}</label>
              <input
                type={f.key.includes('token') || f.key.includes('key') ? 'password' : 'text'}
                value={creds[f.key] || ''}
                onChange={e => setCreds(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-accent bg-white"
              />
            </div>
          ))}
          {svc.authType === 'webhook' && (
            <p className="text-xs text-slate-500 mb-2">
              Connecting will generate a unique webhook URL. Paste it into {svc.name} to start streaming data.
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleConnect} disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-accent hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors">
              {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Connecting…</> : <><Link2 className="w-3 h-3" /> Connect</>}
            </button>
            <button onClick={() => setExpanded(false)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DataConnections() {
  const { user, completeDataSetup } = useAuth();
  const [connections, setConnections] = useState<OrgConnection[]>([]);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const appUrl = window.location.origin;

  useEffect(() => { getConnections().then(setConnections).catch(() => {}); }, []);

  async function handleConnect(svc: ServiceDef, credentials: Record<string, string>) {
    const conn = await addConnection(svc.id, svc.name, Object.keys(credentials).length ? credentials : undefined);
    setConnections(prev => [conn, ...prev]);
  }

  async function handleDelete(id: number) {
    await deleteConnection(id).catch(() => {});
    setConnections(prev => prev.filter(c => c.id !== id));
  }

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setUploadErr(''); setUploading(true);
    try {
      for (const file of Array.from(selected)) {
        await uploadOrgFile(file);
        setUploadedFiles(prev => [...prev, file.name]);
      }
    } catch {
      setUploadErr('Upload failed — only .csv, .txt, .json, .tsv files accepted.');
    } finally { setUploading(false); }
  }

  async function handleComplete() {
    setCompleting(true);
    try { await completeDataSetup(); }
    finally { setCompleting(false); }
  }

  const orgName = user?.orgDisplayName ?? user?.orgName ?? 'Your Organization';
  const categories = Array.from(new Set(SERVICES.map(s => s.category)));

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-12" style={PAPER_BG}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">Paper<span className="text-accent">Trail</span></span>
        </div>

        {/* Stage indicator */}
        <div className="flex items-center justify-center gap-1 mb-6 text-xs">
          {['Org Setup', 'Business Profile', 'Connect Data'].map((label, i) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${i < 2 ? 'bg-green-100 text-green-700' : 'bg-accent text-white'}`}>
                {i < 2 ? <CheckCircle2 className="w-3 h-3" /> : null}{label}
              </span>
              {i < 2 && <span className="text-slate-300">›</span>}
            </span>
          ))}
        </div>

        <div className="bg-white/85 border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Connect {orgName}'s Data Sources</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Connect your accounting software, ERP, and payment systems so PaperTrail can monitor
            live data and detect corruption as it happens — not just when you upload files.
          </p>

          {/* Connection list by category */}
          {categories.map(cat => {
            const svcs = SERVICES.filter(s => s.category === cat);
            return (
              <div key={cat} className="mb-6">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{cat}</p>
                <div className="space-y-2">
                  {svcs.map(svc => (
                    <ServiceCard
                      key={svc.id}
                      svc={svc}
                      connection={connections.find(c => c.service === svc.id)}
                      onConnect={handleConnect}
                      onDelete={handleDelete}
                      appUrl={appUrl}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* File upload fallback */}
          <div className="border-t border-slate-200 pt-6 mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Or Upload Files Directly</p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-accent/50 hover:bg-blue-50/30 rounded-xl p-6 text-center cursor-pointer transition-colors"
            >
              <input ref={fileRef} type="file" multiple accept=".csv,.txt,.json,.tsv" className="hidden" onChange={e => handleFiles(e.target.files)} />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" /> Uploading…
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Drop files or click to browse</p>
                  <p className="text-xs text-slate-400 mt-1">CSV · TXT · JSON · TSV — exports from any system</p>
                </>
              )}
            </div>
            {uploadErr && <p className="text-xs text-red-500 mt-2">{uploadErr}</p>}
            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {uploadedFiles.map((f, i) => (
                  <p key={i} className="text-xs text-green-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {f} uploaded
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Complete button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleComplete} disabled={completing}
              className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              {completing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
                : <>{connections.length > 0 || uploadedFiles.length > 0 ? 'Start Live Monitoring' : 'Continue'} <ArrowRight className="w-4 h-4" /></>
              }
            </button>
            <button onClick={handleComplete} disabled={completing} className="text-slate-400 hover:text-slate-700 text-sm py-3 px-4 rounded-xl transition-colors">
              Skip for now
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            You can add or remove connections at any time from your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
