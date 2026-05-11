import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { OrgSurvey } from '../types';

export interface AuthUser {
  id: number;
  email: string;
  role: 'user' | 'admin';
  orgName: string | null;
  orgType: string | null;
  orgDisplayName: string | null;
  onboardingComplete: boolean;
  surveyComplete: boolean;
  dataSetupComplete: boolean;
  orgSurvey: OrgSurvey | null;
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
  completeOnboarding: (data: { org_name: string; org_type: string; org_display_name: string }) => Promise<void>;
  completeSurvey: (data: OrgSurvey) => Promise<void>;
  completeDataSetup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'pt_token';

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setState((s) => ({ ...s, loading: false })); return; }
    axios.get('/api/auth/me', { headers: authHeader(stored) })
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

  async function completeOnboarding(data: { org_name: string; org_type: string; org_display_name: string }) {
    if (!state.token) return;
    const { data: result } = await axios.post('/api/auth/onboarding', data, {
      headers: authHeader(state.token),
    });
    setState((s) => ({ ...s, user: result.user }));
  }

  async function completeSurvey(data: OrgSurvey) {
    if (!state.token) return;
    const { data: result } = await axios.post('/api/auth/survey', data, {
      headers: authHeader(state.token),
    });
    setState((s) => ({ ...s, user: result.user }));
  }

  async function completeDataSetup() {
    if (!state.token) return;
    const { data: result } = await axios.post('/api/org/complete-setup', {}, {
      headers: authHeader(state.token),
    });
    setState((s) => ({ ...s, user: result.user }));
  }

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, completeOnboarding, completeSurvey, completeDataSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
