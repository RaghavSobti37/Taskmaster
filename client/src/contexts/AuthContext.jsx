import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // NOTE: You will need to create a backend route at GET /api/auth/me
          // that verifies the token and returns the user's data.
          const { data } = await api.get('/auth/me');
          setUser(data);
        } catch (error) {
          console.error('Session expired or token invalid.');
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = async (loginIdentifier, password) => {
    const { data } = await api.post('/auth/login', { login: loginIdentifier, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    navigate('/');
  };

  const register = async (username, email, password) => {
    const { data } = await api.post('/auth/register', { username, email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    navigate('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const value = { user, login, logout, register, loading, isAuthenticated: !!user };

  return (
    <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
  );
};