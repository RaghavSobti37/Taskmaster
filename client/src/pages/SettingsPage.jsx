import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Palette, Save, Globe, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const SettingsPage = () => {
  const { user, login } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      const res = await axios.put('/api/users/profile', { name });
      login(localStorage.getItem('coreknot_token'), res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Update profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-[var(--color-text-secondary)]">Manage profile preferences, workspace aesthetics, and security protocols.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="space-y-1">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'regional', label: 'Regional', icon: Globe },
          ].map(item => (
            <button 
              key={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all
                ${item.id === 'profile' ? 'bg-[var(--color-bg-surface)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)] shadow-sm' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)]'}
              `}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </aside>

        <main className="md:col-span-3 space-y-6">
          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
              <h3 className="font-bold text-[var(--color-text-primary)]">Personal Identity</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">This information will be visible to other operators in the grid.</p>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
              <div className="flex flex-col md:flex-row gap-8 items-center mb-8">
                <div className="w-24 h-24 rounded-3xl bg-[var(--color-bg-workspace)] border-2 border-dashed border-[var(--color-bg-border)] flex items-center justify-center group cursor-pointer hover:border-[var(--color-action-primary)] transition-all">
                  <User size={32} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-action-primary)]" />
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="text-sm font-bold text-[var(--color-text-primary)]">Avatar Upload</h4>
                  <p className="text-xs text-[var(--color-text-muted)]">JPG, PNG or GIF. Max size 2MB.</p>
                  <button type="button" className="text-xs font-bold text-[var(--color-action-primary)] hover:underline">Change image</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none"
                    placeholder="Redacted User"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Email Protocol</label>
                  <input 
                    type="email" 
                    value={email}
                    disabled
                    className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl opacity-60 cursor-not-allowed"
                    placeholder="operator@enterprise.io"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-[var(--color-bg-border)] flex items-center justify-between">
                {success && (
                  <span className="text-xs font-bold text-green-500 animate-bounce">Profile synchronized successfully.</span>
                )}
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-8 py-3 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
                >
                  {loading ? 'Synchronizing...' : <><Save size={18} /> Update Matrix</>}
                </button>
              </div>
            </form>
          </section>

          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
             <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
              <h3 className="font-bold text-[var(--color-text-primary)]">Security Layer</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Credentials and access protocols.</p>
            </div>
            <div className="p-8">
              <button className="flex items-center gap-3 px-6 py-3 border border-[var(--color-bg-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-bg-workspace)] transition-all">
                <Lock size={18} /> Change Security Key
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
