import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from "../../contexts/AuthContext";



const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    if (errorParam === 'unauthorized_domain') {
      setError('Unauthorized domain. Only @theshakticollective.in accounts are allowed.');
    } else if (errorParam === 'auth_failed') {
      setError('Google Authentication failed. Please try again.');
    }
  }, [location]);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

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
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex items-center justify-center p-6">
      {/* Paper texture & Ink spill background */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none bg-[url('/ink_spill_bg.png')] bg-cover bg-center opacity-70 mix-blend-multiply dark:mix-blend-screen dark:opacity-30"
      />
      {/* Pattern from PDF for subtle texture */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none bg-[url('/patterns/pattern_0.png')] bg-repeat opacity-5 mix-blend-overlay"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md bg-card/90 backdrop-blur-md p-8 rounded-3xl border border-border shadow-xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--color-brand-teal)] rounded-2xl mx-auto flex items-center justify-center text-[var(--color-brand-cream)] text-3xl font-black mb-4 shadow-lg shadow-[var(--color-brand-teal)]/30">
            CK
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">TaskMaster</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-3 px-1 leading-relaxed font-medium">
            A comprehensive work management, task tracking platform designed to organize team projects and CRM customer lists.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Email or Username</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                required
                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] focus:border-transparent outline-none transition-all placeholder:text-[var(--color-text-muted)]/50"
                placeholder="Email, Phone, or Name"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="password"
                required
                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] focus:border-transparent outline-none transition-all placeholder:text-[var(--color-text-muted)]/50"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-brand-teal)] text-[var(--color-brand-cream)] py-4 rounded-xl font-bold hover:bg-[var(--color-action-hover)] active:bg-[var(--color-action-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-brand-teal)]/20"
          >
            {loading ? 'Signing in...' : 'Sign In'} <ArrowRight size={20} />
          </button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-[var(--color-text-muted)] font-medium">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white text-gray-700 py-3 rounded-xl font-semibold border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

        </form>

        <div className="mt-8 text-center text-sm space-y-4">
          <p className="text-[var(--color-text-muted)] font-medium">
            New user? <Link to="/register" className="text-[var(--color-brand-teal)] font-bold hover:underline">Register here</Link>
          </p>
          <div className="pt-4 border-t border-border flex items-center justify-center gap-4 text-xs text-[var(--color-text-muted)] font-medium">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <span>•</span>
            <Link to="/userdata" className="hover:text-foreground">User Data Deletion</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
