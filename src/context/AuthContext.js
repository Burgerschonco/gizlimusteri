/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { createContext, useContext, useState, useEffect } from 'react';
import { realdb } from '../firebase/config';
import { ref, get } from 'firebase/database';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [branchInfo, setBranchInfo] = useState(null);

  useEffect(() => {
    // Local storage'dan kullanıcı bilgisini kontrol et
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setIsAdmin(!!userData.email); // email varsa admin
      setBranchInfo(userData.email ? null : userData);
    }
    setLoading(false);
  }, []);

  const login = async (userData) => {
    setUser(userData);
    setIsAdmin(!!userData.email); // email varsa admin
    setBranchInfo(userData.email ? null : userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    setUser(null);
    setIsAdmin(false);
    setBranchInfo(null);
    localStorage.removeItem('user');
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin,
    branchInfo
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}