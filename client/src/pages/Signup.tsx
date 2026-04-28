import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      await signup(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const strong = password.length >= 8;

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4"
      style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=1920&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
      <div className="absolute inset-0 bg-dark-900/80" />

      <div className="relative w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Paper<span className="text-accent">Trail</span></span>
        </div>

        <div className="bg-dark-700 border border-dark-500 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-1">Create account</h1>
          <p className="text-sm text-slate-500 mb-6">Start tracking government spending</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-400 rounded-lg px-3 py-2.5 text-sm mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
                className="w-full bg-dark-600 border border-dark-500 focus:border-accent rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-dark-600 border border-dark-500 focus:border-accent rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-colors text-sm"
              />
              {password.length > 0 && (
                <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${strong ? 'text-green-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-3 h-3" />
                  {strong ? 'Strong password' : 'Use 8+ characters for a stronger password'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                className={`w-full bg-dark-600 border focus:border-accent rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-colors text-sm ${
                  confirm.length > 0 && confirm !== password ? 'border-red-700' : 'border-dark-500'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:text-blue-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
