import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Palette, Save, Globe, Lock, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import CKDropdown from '../components/ui/CKDropdown';
import axios from 'axios';

const SettingsPage = () => {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const roleOptions = [
    { value: 'user', label: 'STANDARD UNIT' },
    { value: 'admin', label: 'ROOT ADMIN' },
  ];
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [role, setRole] = useState(user?.role || 'user');
  const [teams, setTeams] = useState(user?.teams || []);
  const [allTeams, setAllTeams] = useState([]);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useState(() => {
    const fetchTeams = async () => {
      try {
        const res = await axios.get('/api/teams');
        setAllTeams(res.data);
      } catch (err) {
        console.error('Error fetching teams:', err);
      }
    };
    fetchTeams();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      const payload = { name, avatar, phone, teams };
      if (user?.role === 'admin') payload.role = role;
      if (password && newPassword) {
        payload.currentPassword = password;
        payload.newPassword = newPassword;
      }

      const res = await axios.put('/api/users/profile', payload);
      login(localStorage.getItem('coreknot_token'), res.data);
      setSuccess(true);
      setPassword('');
      setNewPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert(err.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const maleAvatars = [
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/45.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/1.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/5.png',
  ];

  const femaleAvatars = [
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/45.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/1.png',
    'https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/5.png',
  ];

  const avatars = user?.gender === 'female' ? femaleAvatars : maleAvatars;

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Account Configuration</h1>
        <p className="text-[var(--color-text-secondary)]">Manage your operative profile and interface aesthetics.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="space-y-1">
          {[
            { id: 'profile', label: 'Operative Profile', icon: User },
            { id: 'appearance', label: 'Interface Look', icon: Palette },
            { id: 'notifications', label: 'Alert Signals', icon: Bell },
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all
                ${activeTab === item.id 
                  ? 'bg-[var(--color-bg-surface)] text-[var(--color-action-primary)] border border-[var(--color-bg-border)] shadow-sm' 
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)]'}
              `}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </aside>

        <main className="md:col-span-3 space-y-6">
          {activeTab === 'profile' && (
            <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
                <h3 className="font-bold text-[var(--color-text-primary)]">Operative Personnel Details</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Data synchronized across the global nexus.</p>
              </div>
              
              <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                <div className="flex flex-col md:flex-row gap-8 items-center mb-8">
                  <div className="w-24 h-24 rounded-3xl bg-[var(--color-bg-workspace)] border-2 border-[var(--color-bg-border)] flex items-center justify-center overflow-hidden shadow-inner">
                    {avatar ? (
                      <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} className="text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <div className="flex-1 space-y-4">
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)]">Select Designation Icon</h4>
                    <div className="flex flex-wrap gap-3">
                      {avatars.map(url => (
                        <button 
                          key={url}
                          type="button"
                          onClick={() => setAvatar(url)}
                          className={`w-12 h-12 rounded-xl border-2 transition-all overflow-hidden ${avatar === url ? 'border-[var(--color-action-primary)] scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          <img src={url} alt="preset" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2 pt-2">
                      <label className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-widest">Custom Uplink URL</label>
                      <input 
                        type="text" 
                        value={avatar}
                        onChange={e => setAvatar(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs outline-none focus:ring-1 focus:ring-[var(--color-action-primary)]"
                        placeholder="Paste image URL here..."
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Full Identity</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none transition-all"
                      placeholder="Operative Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Contact Signal (Phone)</label>
                    <input 
                      type="text" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none transition-all"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--color-bg-border)]">
                  <div className="space-y-2">
                    <CKDropdown 
                      label="Access Protocol (Role)"
                      options={roleOptions}
                      value={role}
                      onChange={setRole}
                      disabled={user?.role !== 'admin'}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Email Node (Fixed)</label>
                    <input 
                      type="email" 
                      value={email}
                      disabled
                      className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl opacity-60 cursor-not-allowed font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-[var(--color-bg-border)]">
                  <CKDropdown 
                    multi
                    label="Nexus Affiliations (Teams)"
                    placeholder="Select your operational teams..."
                    options={allTeams.map(t => ({ value: t.name, label: t.name }))}
                    value={teams}
                    onChange={setTeams}
                  />
                </div>

                <div className="pt-6 border-t border-[var(--color-bg-border)] space-y-6">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Security Override</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">Current Key</label>
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest ml-1">New System Key</label>
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-action-primary)] outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--color-bg-border)] flex items-center justify-between">
                  {success && (
                    <span className="text-xs font-bold text-green-500 animate-bounce">Personnel records updated.</span>
                  )}
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-8 py-3 rounded-xl font-bold hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
                  >
                    {loading ? 'Processing...' : <><Save size={18} /> Sync Account</>}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'appearance' && (
            <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
                <h3 className="font-bold text-[var(--color-text-primary)]">Interface Aesthetics</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Calibrate the visual spectrum of your workspace.</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between p-6 bg-[var(--color-bg-workspace)] rounded-3xl border border-[var(--color-bg-border)]">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] shadow-sm">
                      {theme === 'dark' ? <Moon size={24} className="text-blue-400" /> : <Sun size={24} className="text-orange-400" />}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--color-text-primary)]">Nocturnal Mode</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Optimized for low-light operative environments.</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className={`w-14 h-7 rounded-full transition-all relative ${theme === 'dark' ? 'bg-blue-500 shadow-inner' : 'bg-gray-300 shadow-inner'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${theme === 'dark' ? 'left-8' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
