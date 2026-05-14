import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('coreknot_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('coreknot_token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get('/api/auth/me');
      setUser(res.data);
      localStorage.setItem('coreknot_user', JSON.stringify(res.data));
      setLoading(false);
    } catch (err) {
      logout();
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      const interval = setInterval(fetchUser, 30000); // Sync every 30s
      return () => clearInterval(interval);
    }
  }, [token]);

  const login = (newToken, userData) => {
    localStorage.setItem('coreknot_token', newToken);
    localStorage.setItem('coreknot_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const logout = () => {
    localStorage.removeItem('coreknot_token');
    localStorage.removeItem('coreknot_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
