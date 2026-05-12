import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Crosshair, LogOut, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState, useCallback } from 'react';
import { getUnreadCount } from '../services/api';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const isInvestigate = location.pathname === '/investigate';
  const isAlerts = location.pathname === '/alerts';

  const refreshUnread = useCallback(() => {
    if (!user) return;
    getUnreadCount().then(setUnreadAlerts).catch(() => {});
  }, [user]);

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 60_000);
    return () => clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (isAlerts) setUnreadAlerts(0);
  }, [isAlerts]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="border-b border-dark-500 bg-dark-800/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg leading-none">Paper</span>
            <span className="text-accent font-bold text-lg leading-none">Trail</span>
          </div>
        </Link>

        <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          <span>Enterprise Corruption Detection Platform</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/investigate"
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              isInvestigate
                ? 'bg-accent text-white'
                : 'text-slate-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span className="hidden sm:inline">Investigate</span>
          </Link>

          <Link
            to="/alerts"
            className={`relative flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              isAlerts
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'text-slate-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Alerts</span>
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {unreadAlerts > 99 ? '99+' : unreadAlerts}
              </span>
            )}
          </Link>

          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-dark-500">
              <div className="hidden sm:flex items-center gap-1.5">
                {user.role === 'admin' && (
                  <span title="Admin"><ShieldCheck className="w-3.5 h-3.5 text-accent" /></span>
                )}
                <span className="text-xs text-slate-400 max-w-[120px] truncate">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-dark-600"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
