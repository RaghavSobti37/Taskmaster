import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      login(res.data.token, res.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-workspace)] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[var(--color-bg-surface)] p-8 rounded-3xl border border-[var(--color-bg-border)] shadow-xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--color-action-primary)] rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-blue-500/30">
            CK
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Access CoreKnot</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">Enterprise Work Management Terminal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Email Protocol</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input 
                type="email" 
                required
                className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] focus:border-transparent outline-none transition-all"
                placeholder="operator@enterprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Security Key</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input 
                type="password" 
                required
                className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-action-primary)] text-white py-4 rounded-xl font-bold hover:bg-[var(--color-action-hover)] active:bg-[var(--color-action-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            {loading ? 'Authenticating...' : 'Authenticate'} <ArrowRight size={20} />
          </button>

          {/* Temporary Admin Bypass */}
          <button 
            type="button"
            onClick={() => {
              login('bypass_token', { name: 'Root Admin', email: 'admin@coreknot.io', role: 'admin' });
              navigate('/');
            }}
            className="w-full mt-2 border-2 border-dashed border-[var(--color-bg-border)] text-[var(--color-text-muted)] py-3 rounded-xl text-xs font-bold hover:bg-[var(--color-bg-workspace)] transition-all"
          >
            DEBUG: SYSTEM BYPASS (ADMIN)
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <p className="text-[var(--color-text-muted)]">
            New operator? <Link to="/register" className="text-[var(--color-action-primary)] font-bold hover:underline">Enrollment Gateway</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
