import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();
if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('coreknot_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('coreknot_token'));

  // Use ref to track current user state for deep comparison during polling without triggering re-evaluations
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const logout = useCallback(async () => {
    localStorage.removeItem('coreknot_token');
    localStorage.removeItem('coreknot_user');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/me');
      const newData = res.data;
      
      // Prevent unnecessary re-renders by comparing deep equality
      if (JSON.stringify(userRef.current) !== JSON.stringify(newData)) {
        setUser(newData);
        localStorage.setItem('coreknot_user', JSON.stringify(newData));
      }
      setLoading(false);
    } catch (err) {
      logout();
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  }, [token, fetchUser]);

  useEffect(() => {
    if (token) {
      const interval = setInterval(fetchUser, 30000);
      return () => clearInterval(interval);
    }
  }, [token, fetchUser]);

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('coreknot_token', newToken);
    localStorage.setItem('coreknot_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    login,
    logout
  }), [user, token, loading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
