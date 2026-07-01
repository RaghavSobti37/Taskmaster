import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, ArrowRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from "../../contexts/AuthContext";
import { navigateAfterAuth } from '../../utils/authNavigation';
import { useDepartments } from '../../hooks/useTaskmasterQueries';
import MarketingPageBackground from '../../components/MarketingPageBackground';
import BrandLogo from '../../components/brand/BrandLogo';
import { brand, registerCopy } from '../../constants/marketingContent';

const LegacyRegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('male');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: departments = [], isLoading: departmentsLoading } = useDepartments(true);

  useEffect(() => {
    if (!authLoading && user) {
      navigateAfterAuth(navigate, '/dashboard');
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/auth/register', { name, email, password, gender, departmentId: departmentId || undefined });
      await login();
      navigateAfterAuth(navigate, '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground relative overflow-hidden grid place-items-center p-6">
      <MarketingPageBackground />
      <div className="tm-modal-panel max-w-md relative z-10 bg-card p-8 rounded-3xl border border-border shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="text-center mb-8">
          <BrandLogo size={64} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{registerCopy.title}</h1>
          <p className="text-[var(--color-text-secondary)] mt-2 font-medium">{registerCopy.subtitle}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Full Name</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                required
                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] outline-none transition-all placeholder:text-[var(--color-text-muted)]/50"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="email"
                required
                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] outline-none transition-all placeholder:text-[var(--color-text-muted)]/50"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Gender</label>
            <div className="grid grid-cols-3 gap-2">
              {['male', 'female', 'other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`py-2 rounded-xl text-xs font-bold capitalize transition-all border ${gender === g ? 'bg-[var(--color-brand-teal)] text-[var(--color-brand-cream)] border-[var(--color-brand-teal)] shadow-md' : 'bg-background text-[var(--color-text-secondary)] border-border hover:border-[var(--color-brand-teal)]/50 hover:bg-background/80'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={departmentsLoading}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] outline-none disabled:opacity-60"
            >
              <option value="">{departmentsLoading ? 'Loading…' : 'Select department'}</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[var(--color-text-secondary)] ml-1">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="password"
                required
                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] outline-none transition-all placeholder:text-[var(--color-text-muted)]/50"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-brand-teal)] text-[var(--color-brand-cream)] py-4 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-brand-teal)]/20"
          >
            {loading ? 'Registering...' : registerCopy.submitLabel} <ArrowRight size={20} />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center text-sm">
          <p className="text-[var(--color-text-muted)] font-medium mb-4">
            {registerCopy.signInPrompt}
          </p>
          <Link to="/login" className="flex items-center justify-center w-full py-3 rounded-xl bg-card border border-border text-foreground font-bold hover:bg-background transition shadow-sm">
            {registerCopy.signInLink}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LegacyRegisterPage;
