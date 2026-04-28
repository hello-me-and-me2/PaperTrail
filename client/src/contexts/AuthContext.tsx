import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

export interface AuthUser {
  id: number;
  email: string;
  role: 'user' | 'admin';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'pt_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setState((s) => ({ ...s, loading: false })); return; }

    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then(({ data }) => setState({ user: data.user, token: stored, loading: false }))
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setState({ user: null, token: null, loading: false }); });
  }, []);

  async function login(email: string, password: string) {
    const { data } = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setState({ user: data.user, token: data.token, loading: false });
  }

  async function signup(email: string, password: string) {
    const { data } = await axios.post('/api/auth/signup', { email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    setState({ user: data.user, token: data.token, loading: false });
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, token: null, loading: false });
  }

  return <AuthContext.Provider value={{ ...state, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
