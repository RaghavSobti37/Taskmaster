import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, ArrowRight } from 'lucide-react';
import { Link000 as Link } from '../../components/ui/skiper-ui/skiper40';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from "../../contexts/AuthContext";
import { useDepartments } from '../../hooks/useTaskmasterQueries';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('male');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { data: departments = [] } = useDepartments(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', { name, email, password, gender, departmentId: departmentId || undefined });
      login(res.data.token, res.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden grid place-items-center p-6">
      {/* Paper texture & Ink spill background */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none bg-[url('/ink_spill_bg.png')] bg-cover bg-center opacity-70 mix-blend-multiply dark:mix-blend-screen dark:opacity-30"
      />
      {/* Pattern from PDF for subtle texture */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none bg-[url('/patterns/pattern_0.png')] bg-repeat opacity-5 mix-blend-overlay"
      />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="tm-modal-panel max-w-md relative z-10 bg-card backdrop-blur-md p-8 rounded-3xl border border-border shadow-xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--color-brand-teal)] rounded-2xl mx-auto flex items-center justify-center text-[var(--color-brand-cream)] text-3xl font-black mb-4 shadow-lg shadow-[var(--color-brand-teal)]/30">
            CK
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Account</h1>
          <p className="text-[var(--color-text-secondary)] mt-2 font-medium">Join the team today</p>
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
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-[var(--color-brand-teal)] outline-none"
            >
              <option value="">Select department</option>
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
            {loading ? 'Registering...' : 'Sign Up'} <ArrowRight size={20} />
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <p className="text-[var(--color-text-muted)] font-medium">
            Already have an account? <Link to="/login" className="text-[var(--color-brand-teal)] font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;


// Performance Optimization: useCallback(eventHandler) memoization guard
