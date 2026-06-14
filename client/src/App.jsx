import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import RepTool from './pages/RepTool.jsx';
import ManagerDashboard from './pages/ManagerDashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';

function RootRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    if (user.role === 'superadmin') navigate('/admin', { replace: true });
    else if (user.role === 'manager') navigate('/knocktrakr/manager', { replace: true });
    else navigate('/knocktrakr/rep', { replace: true });
  }, [user, loading]);

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--kt-navy)' }}>
      <img src="/icons/wordmark-white.png" alt="KnockTrakr" style={{ height: '28px', opacity: 0.9 }} />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/about" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route
        path="/knocktrakr/rep"
        element={
          <RoleRoute roles={['rep', 'manager', 'superadmin']}>
            <RepTool />
          </RoleRoute>
        }
      />
      <Route
        path="/knocktrakr/manager"
        element={
          <RoleRoute roles={['manager', 'superadmin']}>
            <ManagerDashboard />
          </RoleRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <RoleRoute roles={['superadmin']}>
            <AdminPanel />
          </RoleRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
