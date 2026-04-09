import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-slate rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
