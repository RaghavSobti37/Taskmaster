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
          console.log('🔐 [AUTH] Loading user from token...');
          const { data } = await api.get('/auth/me');
          console.log('🔐 [AUTH] User loaded:', data);
          setUser(data);
        } catch (error) {
          console.error('🔐 [AUTH] Session expired or token invalid.', error.message);
          localStorage.removeItem('token');
        }
      } else {
        console.log('🔐 [AUTH] No token in storage');
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = async (loginIdentifier, password) => {
    try {
      console.log('🔐 [AUTH] Login attempt:', { loginIdentifier, passwordLength: password.length });
      console.log('🔐 [AUTH] Sending to /auth/login:', { login: loginIdentifier, password });
      
      const { data } = await api.post('/auth/login', { login: loginIdentifier, password });
      
      console.log('🔐 [AUTH] Login response received:', data);
      localStorage.setItem('token', data.token);
      console.log('🔐 [AUTH] Token saved to localStorage');
      setUser(data.user);
      console.log('🔐 [AUTH] User set in context:', data.user);
      console.log('🔐 [AUTH] Navigating to home...');
      navigate('/');
    } catch (error) {
      console.error('🔐 [AUTH] Login failed:', error.response?.data || error.message);
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      console.log('🔐 [AUTH] Register attempt:', { username, email, passwordLength: password.length });
      console.log('🔐 [AUTH] Sending to /auth/register:', { username, email, password });
      
      const { data } = await api.post('/auth/register', { username, email, password });
      
      console.log('🔐 [AUTH] Register response received:', data);
      localStorage.setItem('token', data.token);
      console.log('🔐 [AUTH] Token saved to localStorage');
      setUser(data.user);
      console.log('🔐 [AUTH] User set in context:', data.user);
      console.log('🔐 [AUTH] Navigating to home...');
      navigate('/');
    } catch (error) {
      console.error('🔐 [AUTH] Register failed:', error.response?.data || error.message);
      throw error;
    }
  };

  const logout = () => {
    console.log('🔐 [AUTH] Logout');
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const updateUserProfile = (updatedUserData) => {
    console.log('🔐 [AUTH] Updating user profile:', updatedUserData);
    setUser(updatedUserData);
  };

  const value = { user, login, logout, register, loading, isAuthenticated: !!user, updateUserProfile };

  return (
    <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
  );
};