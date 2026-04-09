import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
// Components
import { ProtectedRoute, RootRedirect } from './components';
import { SubscriptionGuard } from './components/auth/SubscriptionGuard';
import { AdminGuard } from './components/auth/AdminGuard';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ClientsPage from './pages/ClientsPage';
import LoansPage from './pages/LoansPage';
import LoanDetailPage from './pages/LoanDetailPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import SubscriptionPage from './pages/SubscriptionPage';
import CapitalPage from './pages/CapitalPage';

// Admin Pages
import AdminStats from './pages/admin/AdminStats';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';
import AdminPayments from './pages/admin/AdminPayments';
import AdminSystem from './pages/admin/AdminSystem';
import TermsPage from './pages/TermsPage';

import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    // Also scroll the dashboard's main container if the user is inside
    const mainArea = document.querySelector('main');
    if (mainArea) mainArea.scrollTop = 0;
  }, [pathname]);
  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/register" element={<RegisterPage />} />
          <Route path="/terminos" element={<TermsPage />} />
          <Route path="/subscription" element={<SubscriptionPage />} />

          {/* Protected Dashboard Routes (subscription gated) */}
          <Route 
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <DashboardLayout />
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/capital" element={<CapitalPage />} />
            <Route path="/prestamos" element={<LoansPage />} />
            <Route path="/prestamos/:id" element={<LoanDetailPage />} />
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/historial" element={<HistoryPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
          </Route>

          {/* Admin Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AdminGuard>
                  <AdminLayout />
                </AdminGuard>
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminStats />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/system" element={<AdminSystem />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
