import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin w-8 h-8 border-4 border-garden border-t-transparent rounded-full"></div>
  </div>
);

// Pintu masuk utama: wajib login (admin maupun staff).
// Portal klien (/portal, /share) TIDAK memakai ini — tetap publik.
export const RequireAuth = ({ children }) => {
  const { user, loading } = useAdmin();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

// Panel admin: otomatis lolos jika role admin, ditolak jika bukan.
const ProtectedRoute = ({ children }) => {
  const { user, isAdmin, loading } = useAdmin();

  if (loading) return <Spinner />;
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
