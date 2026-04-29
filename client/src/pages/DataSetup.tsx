import { useState, useRef, useEffect } from 'react';
import {
  FileText, Upload, X, CheckCircle2, Loader2, ArrowRight,
  Users, Building2, DollarSign, FileSpreadsheet, Receipt, MessageSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { uploadOrgFile, listOrgFiles, deleteOrgFile } from '../services/api';

const PAPER_BG: React.CSSProperties = {
  backgroundColor: '#fdf8ef',
  backgroundImage: [
    'radial-gradient(ellipse 90% 55% at 22% 20%, rgba(255,255,255,0.42) 0%, transparent 70%)',
    'radial-gradient(ellipse 60% 45% at 78% 68%, rgba(0,0,0,0.022) 0%, transparent 70%)',
    'linear-gradient(90deg, transparent 70px, rgba(244,164,164,0.5) 70px, rgba(244,164,164,0.5) 72px, transparent 72px)',
    'repeating-linear-gradient(180deg, transparent 0, transparent 27px, rgba(180,210,245,0.62) 27px, rgba(180,210,245,0.62) 28.5px)',
  ].join(', '),
};

const SUGGESTED_DOCS = [
  { icon: Users,          label: 'Employee / Personnel Directory',  hint: 'Names, roles, departments, hire dates' },
  { icon: Building2,      label: 'Vendor & Supplier List',          hint: 'Vendor names, contract amounts, categories' },
  { icon: DollarSign,     label: 'Financial Transactions / Ledger', hint: 'Transaction dates, amounts, accounts' },
  { icon: FileSpreadsheet,label: 'Contract Records',                hint: 'Contract IDs, parties, values, dates' },
  { icon: Receipt,        label: 'Expense Reports',                 hint: 'Submitter, amount, category, approver' },
  { icon: MessageSquare,  label: 'Meeting Minutes / Communications',hint: 'Dates, attendees, decisions made' },
];

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

export default function DataSetup() {
  const { user, completeDataSetup } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listOrgFiles().then(setFiles).catch(() => {});
  }, []);

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setUploadError('');
    setUploading(true);
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setUploadError(msg || 'Upload failed. Only .csv, .txt, .json, and .tsv files are accepted.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteOrgFile(id).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  async function handleComplete() {
    setCompleting(true);
    try { await completeDataSetup(); }
    finally { setCompleting(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={PAPER_BG}>
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">
            Paper<span className="text-accent">Trail</span>
          </span>
        </div>

        <div className="bg-white/85 border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900 mb-1">
              Connect {user?.orgDisplayName ?? user?.orgName ?? 'Your Organization'}'s Data
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Upload internal records so AI can detect corruption within your organization. All data is private,
              encrypted, and used solely for your organization's risk analysis. The AI combines your files with
              all credible public sources for the most accurate picture.
            </p>
          </div>

          {/* Suggested document types */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Suggested Documents</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_DOCS.map(({ icon: Icon, label, hint }) => (
                <div key={label} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${
              dragOver ? 'border-accent bg-accent/5' : 'border-slate-300 hover:border-accent/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".csv,.txt,.json,.tsv"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm text-slate-500">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Drop files here or click to browse</p>
                <p className="text-xs text-slate-400">Accepts .csv · .txt · .json · .tsv — up to 10 MB each</p>
              </div>
            )}
          </div>

          {uploadError && (
            <p className="text-xs text-red-500 mb-4">{uploadError}</p>
          )}

          {/* Uploaded files list */}
          {files.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Uploaded Files</p>
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{f.original_name}</p>
                      <p className="text-xs text-slate-400">{f.file_type.toUpperCase()} · {fmtSize(f.file_size)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleComplete}
              disabled={completing}
              className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {completing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
                : <>{files.length > 0 ? 'Complete Setup' : 'Complete Setup'} <ArrowRight className="w-4 h-4" /></>
              }
            </button>
            <button
              onClick={handleComplete}
              disabled={completing}
              className="text-slate-400 hover:text-slate-700 text-sm py-3 px-4 rounded-xl transition-colors"
            >
              Skip for now
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            You can upload or remove files at any time from your account settings.
          </p>
        </div>
      </div>
    </div>
  );
}
