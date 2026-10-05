import React, { createContext, useContext, useState } from 'react';

const AdminContext = createContext(null);

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

export const AdminProvider = ({ children }) => {
  // Baca session secara synchronous agar refresh halaman admin
  // tidak kedip loading/login dulu.
  const [isAdmin, setIsAdmin] = useState(
    () => sessionStorage.getItem('adminSession') === 'true'
  );
  const [loading, setLoading] = useState(false);

  const login = (password) => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      sessionStorage.setItem('adminSession', 'true');
      return { success: true };
    }
    return { success: false, message: 'Password salah!' };
  };

  const logout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem('adminSession');
  };

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout, loading }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};
