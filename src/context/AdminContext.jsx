import { AuthProvider, useAuth } from './AuthContext';

// Compat shim: kode lama (ProtectedRoute, AdminDashboard, App) tetap pakai
// nama useAdmin/AdminProvider, tapi di dalamnya sudah auth backend beneran.
// Kode baru langsung pakai useAuth dari ./AuthContext.
export const AdminProvider = AuthProvider;
export const useAdmin = useAuth;
