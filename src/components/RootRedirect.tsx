import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LandingPage from '../pages/Landing';

/**
 * RootRedirect Component
 * Handles intelligent routing at the base path (/).
 * 
 * Logic:
 * 1. If the app is NOT in standalone mode (Browser):
 *    - Render the LandingPage directly at the root path.
 * 2. If the app IS in standalone mode (Installed PWA):
 *    - Redirect to /dashboard if the user is authenticated.
 *    - Redirect to /login if the user is NOT authenticated.
 */
const RootRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  
  // Detect if the app is running in "standalone" mode (installed PWA)
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true;

  if (loading) {
    // Show a minimal loading state while we check auth status
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0b]">
        <div className="w-8 h-8 border-4 border-[#00f2fe] rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // If in standalone mode (App installed)
  if (isStandalone) {
    if (!user) {
      // Redirect to login if NO session exists
      return <Navigate to="/login" replace />;
    }
    // Redirect to dashboard if session exists
    return <Navigate to="/dashboard" replace />;
  }

  // Default browser behavior: show the landing page
  return <LandingPage />;
};

export default RootRedirect;
