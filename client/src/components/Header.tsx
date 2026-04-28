import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, FileText, AlertTriangle, Crosshair, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isHome = location.pathname === '/';
  const isInvestigate = location.pathname === '/investigate';

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
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
          <span>Data: USASpending.gov — Federal Open Data</span>
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

          {!isHome && !isInvestigate && (
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors px-2"
            >
              <Search className="w-4 h-4" />
            </Link>
          )}

          {/* User badge */}
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
