import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCheck, ExternalLink, ShieldAlert, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CorruptionAlert } from '../types';
import { getAlerts, markAlertRead, markAllAlertsRead } from '../services/api';

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-400/10 border-red-500/30',
  HIGH: 'text-orange-400 bg-orange-400/10 border-orange-500/30',
  MODERATE: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
  LOW: 'text-green-400 bg-green-400/10 border-green-500/30',
};

const SEV_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MODERATE: 'bg-yellow-500',
  LOW: 'bg-green-500',
};

export default function Alerts() {
  const [alerts, setAlerts] = useState<CorruptionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkRead(id: number) {
    await markAlertRead(id);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read_at: new Date().toISOString() } : a));
  }

  async function handleMarkAllRead() {
    await markAllAlertsRead();
    const now = new Date().toISOString();
    setAlerts((prev) => prev.map((a) => ({ ...a, read_at: a.read_at ?? now })));
  }

  async function handleOpenAlert(alert: CorruptionAlert) {
    if (!alert.read_at) await handleMarkRead(alert.id);
    if (alert.analysis_url) {
      navigate(alert.analysis_url);
    }
  }

  const unread = alerts.filter((a) => !a.read_at).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Corruption Alerts</h1>
            <p className="text-xs text-slate-400">
              {unread > 0 ? `${unread} unread alert${unread !== 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-dark-600 border border-dark-500 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-500">Loading alerts…</div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="text-center py-20">
          <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No alerts yet</p>
          <p className="text-sm text-slate-500 mt-1">
            The monitor will notify you here when suspicious activity is detected in your connected data.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`relative rounded-xl border p-4 transition-all ${
              alert.read_at
                ? 'border-dark-500 bg-dark-700/40'
                : 'border-dark-400 bg-dark-700'
            }`}
          >
            {!alert.read_at && (
              <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-accent" />
            )}

            <div className="flex items-start gap-3">
              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${SEV_DOT[alert.severity] ?? 'bg-slate-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SEV_COLOR[alert.severity] ?? ''}`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-slate-500 capitalize">{alert.entity_type}</span>
                  <span className="text-xs text-slate-600">
                    {new Date(alert.detected_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white mb-0.5">{alert.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{alert.description}</p>

                <div className="flex items-center gap-3 mt-3">
                  {alert.analysis_url && (
                    <button
                      onClick={() => handleOpenAlert(alert)}
                      className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium transition-colors"
                    >
                      View analysis
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  <span className="text-xs text-slate-600">
                    Risk score: <span className="text-slate-400 font-mono">{alert.score}/100</span>
                  </span>
                  {!alert.read_at && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="text-xs text-slate-500 hover:text-slate-300 ml-auto transition-colors"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
