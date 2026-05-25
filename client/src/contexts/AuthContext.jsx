import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { subscribeToChannel } from '../lib/supabase';
import toast from 'react-hot-toast';

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
      if (err.response?.status === 401) {
        logout();
      }
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

  useEffect(() => {
    if (user?._id) {
      const unsubscribe = subscribeToChannel(`user-${user._id}`, 'xp_awarded', (payload) => {
        setUser(prev => ({ 
          ...prev, 
          exp: payload.newTotal, 
          level: payload.leveledUp ? (prev.level || 1) + 1 : prev.level 
        }));
        
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] shadow-2xl rounded-2xl pointer-events-auto flex overflow-hidden`}>
             <div className="p-4 flex-1">
               <div className="flex items-center">
                 <div className="flex-shrink-0 bg-blue-500/10 p-2 rounded-xl">
                    <span className="text-xl">✨</span>
                 </div>
                 <div className="ml-3 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                      XP Gained!
                    </p>
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-0.5">
                      +{payload.amount} XP • {payload.action.replace(/_/g, ' ')}
                    </p>
                    <div className="mt-2 w-full bg-[var(--color-bg-border)] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-out" 
                           style={{ width: '100%', animation: 'fillBar 1s ease-out' }}></div>
                    </div>
                 </div>
               </div>
             </div>
          </div>
        ), { duration: 4000 });
      });
      return () => unsubscribe();
    }
  }, [user?._id]);

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
