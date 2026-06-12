import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import RepTool from './pages/RepTool.jsx';
import ManagerDashboard from './pages/ManagerDashboard.jsx';
import AdminPanel from './pages/AdminPanel.jsx';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
