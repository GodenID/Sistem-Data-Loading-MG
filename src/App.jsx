import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AdminProvider } from './context/AdminContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Toaster from './components/Toaster';
import Home from './pages/Home';
import ClientDetail from './pages/ClientDetail';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminHistory from './pages/AdminHistory';
import AdminClients from './pages/AdminClients';

import PublicClientView from './pages/PublicClientView';
import PublicShareView from './pages/PublicShareView';
import NotFound from './pages/NotFound';

function App() {
  return (
    <ErrorBoundary>
      <AdminProvider>
        <Toaster />
        <Router>
          <Routes>
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
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AdminProvider>
    </ErrorBoundary>
  );
}

export default App;
