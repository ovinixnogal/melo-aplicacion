import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const location = useLocation();

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A1A] relative overflow-hidden text-center">
        <div className="absolute inset-0 bg-grain opacity-5" />
        <div className="relative flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-[#E2FF3B] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(226,255,59,0.1)]"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 animate-pulse italic">Sincronizando Acceso</p>
        </div>
      </div>
    );
  }

  // Admins always pass
  if (user?.isAdmin) {
    return <>{children}</>;
  }

  // Not active? Redirect to subscription
  if (!isActive) {
    return <Navigate to="/subscription" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
