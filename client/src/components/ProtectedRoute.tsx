import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Onboarding from '../pages/Onboarding';
import DataSetup from '../pages/DataSetup';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboardingComplete) return <Onboarding />;
  if (!user.dataSetupComplete) return <DataSetup />;

  return <>{children}</>;
}
