import React from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AdminProvider } from './context/AdminContext';
import { UploadQueueProvider } from './context/UploadQueueContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Toaster from './components/Toaster';
import UploadDock from './components/UploadDock';
import OfflineBanner from './components/OfflineBanner';
import Home from './pages/Home';
import ClientDetail from './pages/ClientDetail';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminHistory from './pages/AdminHistory';
import AdminClients from './pages/AdminClients';
import AdminUsers from './pages/AdminUsers';

import PublicClientView from './pages/PublicClientView';
import PublicShareView from './pages/PublicShareView';
import NotFound from './pages/NotFound';

// Kembali ke atas tiap pindah halaman + animasi masuk halus (anti kedip putih)
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      <Routes location={location}>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/client/:slug" element={<ClientDetail />} />
      <Route path="/portal/:token" element={<PublicClientView />} />
      <Route path="/share/:token" element={<PublicShareView />} />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/history" element={
        <ProtectedRoute>
          <AdminHistory />
        </ProtectedRoute>
      } />
      <Route path="/admin/clients" element={
        <ProtectedRoute>
          <AdminClients />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute>
          <AdminUsers />
        </ProtectedRoute>
      } />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AdminProvider>
        <UploadQueueProvider>
          <Toaster />
          <Router>
            <ScrollToTop />
            <OfflineBanner />
            <AnimatedRoutes />
            <UploadDock />
          </Router>
        </UploadQueueProvider>
      </AdminProvider>
    </ErrorBoundary>
  );
}

export default App;
