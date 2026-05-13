import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Bell,
  Shield,
  ShieldCheck,
  Palette,
  Save,
  Globe,
  Lock,
  Sun,
  Moon,
  Smartphone,
  Mail,
  Users,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Camera,
  Layers,
  Settings,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  X,
  Sparkles,
  Cpu,
  Gamepad2,
  Shapes,
  UserSquare2
} from 'lucide-react';
import { Badge, NexusModal } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import CKDropdown from '../components/ui/CKDropdown';
import axios from 'axios';

const SettingsPage = () => {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [phone, setPhone] = useState(user?.phone || '+91 ');
  const [role, setRole] = useState(user?.role || 'user');
  const [teams, setTeams] = useState(user?.teams || []);
  const [allTeams, setAllTeams] = useState([]);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Cartoons');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    Notification.permission === 'granted'
  );

  const roleOptions = [
    { value: 'user', label: 'STANDARD UNIT' },
    { value: 'admin', label: 'ROOT ADMIN' },
  ];

  const categories = [
    { id: 'Cartoons', icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'Bots', icon: Cpu, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'Pixels', icon: Gamepad2, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'Shapes', icon: Shapes, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'Minimal', icon: UserSquare2, color: 'text-rose-500', bg: 'bg-rose-500/10' }
  ];

  const avatarCategories = {
    'Cartoons': [
      ...Array.from({ length: 10 }, (_, i) => `https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/male/${i + 1}.png`),
      ...Array.from({ length: 10 }, (_, i) => `https://raw.githubusercontent.com/Ashwinvalento/cartoon-avatar/master/lib/images/female/${i + 1}.png`),
    ],
    'Bots': Array.from({ length: 12 }, (_, i) => `https://api.dicebear.com/7.x/bottts/svg?seed=bot${i}&backgroundColor=b6e3f4,c0aede,d1d4f9`),
    'Pixels': Array.from({ length: 12 }, (_, i) => `https://api.dicebear.com/7.x/pixel-art/svg?seed=pixel${i}&backgroundColor=b6e3f4,c0aede,d1d4f9`),
    'Shapes': Array.from({ length: 12 }, (_, i) => `https://api.dicebear.com/7.x/shapes/svg?seed=shape${i}&backgroundColor=b6e3f4,c0aede,d1d4f9`),
    'Minimal': Array.from({ length: 12 }, (_, i) => `https://api.dicebear.com/7.x/micah/svg?seed=micah${i}&backgroundColor=b6e3f4,c0aede,d1d4f9`),
  };

  useEffect(() => {
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
    if (e) e.preventDefault();
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
      setModalConfig({
        isOpen: true,
        title: 'Synchronization Error',
        message: err.response?.data?.error || 'Failed to update operative profile.',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        setNotificationsEnabled(false);
      }
    } else {
      setNotificationsEnabled(!notificationsEnabled);
    }
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-32">
      {/* Premium Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-xl text-blue-500 shadow-2xl border border-white/5">
              <Settings size={20} className="animate-spin-slow" />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-[var(--color-text-primary)] uppercase">
              Configuration
            </h1>
          </div>
          <p className="text-[10px] md:text-xs font-medium text-[var(--color-text-muted)] ml-12 md:ml-14">Calibrate operative parameters and interface protocols.</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-bg-border)] shadow-sm self-start md:self-center">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">Security Cleared</span>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 gap-10">
        {/* Profile Section */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden"
        >
          <div className="px-6 md:px-10 py-6 md:py-10 border-b border-[var(--color-bg-border)] bg-gradient-to-r from-[var(--color-bg-workspace)] to-transparent flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-5">
              <div className="p-2.5 md:p-3 bg-blue-500/10 rounded-xl md:rounded-2xl text-blue-500 shadow-sm">
                <User size={18} md:size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-black tracking-tight text-[var(--color-text-primary)] uppercase">Operative Profile</h3>
                <p className="hidden sm:block text-xs text-[var(--color-text-muted)] font-medium">Core identity and designation data.</p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-10 space-y-8 md:space-y-10">
            {/* Avatar Profile Interaction */}
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-[var(--color-bg-workspace)]/40 p-6 md:p-8 rounded-[2rem] border border-[var(--color-bg-border)] group">
              <div
                onClick={() => setIsAvatarModalOpen(true)}
                className="relative cursor-pointer group/avatar"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-3xl bg-[var(--color-bg-surface)] border-4 border-blue-500/20 flex items-center justify-center overflow-hidden shadow-2xl group-hover/avatar:border-blue-500/50 transition-all">
                  {avatar ? (
                    <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={32} md:size={40} className="text-[var(--color-text-muted)]" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-all">
                    <Camera size={20} className="text-white" />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 md:p-2 bg-blue-500 text-white rounded-lg md:rounded-xl shadow-lg border-2 border-[var(--color-bg-surface)]">
                  <Sparkles size={12} md:size={14} />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left space-y-1.5">
                <h4 className="text-lg md:text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight">Designation Identity</h4>
                <p className="text-[10px] md:text-xs text-[var(--color-text-muted)] font-medium">Operative: {name || 'UNINITIALIZED'}</p>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="mt-2 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors bg-blue-500/5 px-4 py-2 rounded-lg border border-blue-500/10"
                >
                  Change Profile Icon
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] ml-1">Personnel Name</label>
                <div className="relative group">
                  <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-5 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="Enter Identity"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] ml-1">Contact Signal</label>
                <div className="flex gap-2">
                  <div className="relative w-24">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                      <Globe size={12} />
                    </div>
                    <select className="w-full pl-8 pr-3 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold appearance-none cursor-pointer">
                      <option value="+91">+91 (IN)</option>
                    </select>
                    <ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                  </div>
                  <div className="relative flex-1 group">
                    <Smartphone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      value={phone.replace(/^\+91\s*/, '')}
                      onChange={(e) => setPhone('+91 ' + e.target.value)}
                      className="w-full pl-11 pr-5 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="98765 43210"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-[var(--color-bg-border)]">
              <CKDropdown
                label="Access Clearance"
                options={roleOptions}
                value={role}
                onChange={setRole}
                disabled={user?.role !== 'admin'}
              />
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] ml-1">Email Node (Static)</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] opacity-50" />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full pl-11 pr-5 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-medium opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[var(--color-bg-border)]">
              <CKDropdown
                multi
                label="Nexus Team Affiliations"
                placeholder="Assign operational units..."
                options={allTeams.map(t => ({ value: t.name, label: t.name }))}
                value={teams}
                onChange={setTeams}
              />
            </div>

            <div className="pt-6 border-t border-[var(--color-bg-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 text-emerald-500 font-black text-[9px] md:text-[10px] uppercase tracking-widest"
                  >
                    <CheckCircle2 size={12} md:size={14} /> Data Synced Successfully
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.3em] hover:bg-slate-800 disabled:opacity-50 transition-all shadow-2xl active:scale-95"
              >
                {loading ? 'Processing...' : <><Save size={14} /> Sync Profile</>}
              </button>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Preferences & Aesthetics */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
              <h3 className="text-base font-black tracking-tight uppercase">Interface Protocols</h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between p-5 bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)] shadow-sm hover:border-blue-500/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg border transition-all ${theme === 'dark' ? 'bg-slate-900 border-white/5 text-blue-400' : 'bg-white border-slate-200 text-orange-400'}`}>
                    {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                  </div>
                  <div>
                    <p className="text-xs font-black text-[var(--color-text-primary)]">Nocturnal Shift</p>
                    <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-tight">Dark mode environment</p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`w-10 h-5 rounded-full transition-all relative ${theme === 'dark' ? 'bg-blue-600 shadow-inner' : 'bg-slate-200 shadow-inner'}`}
                >
                  <motion.div
                    layout
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-xl"
                    animate={{ x: theme === 'dark' ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Notifications Toggle */}
              <div className="flex items-center justify-between p-5 bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)] shadow-sm hover:border-emerald-500/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg border transition-all ${notificationsEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                    <Bell size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[var(--color-text-primary)]">Alert Signals</p>
                    <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-tight">Browser Notifications</p>
                  </div>
                </div>
                <button
                  onClick={requestNotificationPermission}
                  className={`w-10 h-5 rounded-full transition-all relative ${notificationsEnabled ? 'bg-emerald-500 shadow-inner' : 'bg-slate-200 shadow-inner'}`}
                >
                  <motion.div
                    layout
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-xl"
                    animate={{ x: notificationsEnabled ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </div>
          </motion.section>

          {/* Security Section */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
              <h3 className="text-base font-black tracking-tight uppercase">Security Vault</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Current Protocol Key</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">New Access Key</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl flex gap-3">
                <ShieldAlert size={16} className="text-orange-500 shrink-0" />
                <p className="text-[8px] font-bold text-orange-700 dark:text-orange-300 leading-relaxed uppercase tracking-tight">
                  Warning: Changing access key will require full system re-authentication across active deployments.
                </p>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Categorized Avatar Modal */}
      <AnimatePresence>
        {isAvatarModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAvatarModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-[var(--color-bg-surface)] rounded-[3rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <header className="p-4 md:p-8 border-b border-[var(--color-bg-border)] bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-white/10 rounded-xl md:rounded-2xl border border-white/5">
                    <Sparkles size={16} md:size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-xl font-black uppercase tracking-tight">Icon Hub</h3>
                    <p className="hidden sm:block text-[9px] md:text-[10px] font-bold text-blue-400 uppercase tracking-widest">Select your visual signature</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAvatarModalOpen(false)}
                  className="p-2 md:p-3 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all"
                >
                  <X size={18} md:size={20} />
                </button>
              </header>

              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* Category Sidebar */}
                <aside className="w-full lg:w-64 bg-[var(--color-bg-workspace)]/50 border-r border-[var(--color-bg-border)] p-4 md:p-6 overflow-x-auto lg:overflow-y-auto no-scrollbar">
                  <div className="flex lg:flex-col gap-2 min-w-max lg:min-w-0">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`flex items-center gap-3 px-4 py-2.5 md:py-3.5 rounded-xl transition-all whitespace-nowrap lg:w-full ${activeCategory === cat.id ? 'bg-slate-900 text-white shadow-xl' : 'hover:bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]'}`}
                      >
                        <div className={`p-1.5 md:p-2 rounded-lg transition-all ${activeCategory === cat.id ? 'bg-white/10 text-white' : `${cat.bg} ${cat.color}`}`}>
                          <cat.icon size={12} md:size={14} />
                        </div>
                        <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{cat.id}</span>
                      </button>
                    ))}
                  </div>
                </aside>

                {/* Grid Area */}
                <main className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-gradient-to-br from-transparent to-[var(--color-bg-workspace)]/30">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-4">
                    {avatarCategories[activeCategory].map((url, idx) => (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setAvatar(url);
                          setIsAvatarModalOpen(false);
                        }}
                        className={`aspect-square rounded-2xl border-4 transition-all overflow-hidden relative shadow-sm hover:shadow-xl ${avatar === url ? 'border-blue-500 bg-blue-500/10' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]'}`}
                      >
                        <img src={url} alt="preset" className="w-full h-full object-cover" />
                        {avatar === url && (
                          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                            <CheckCircle2 size={24} className="text-white drop-shadow-lg" />
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </main>
              </div>

              <footer className="p-4 md:p-6 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[var(--color-bg-surface)] border-2 border-[var(--color-bg-border)] overflow-hidden">
                    {avatar && <img src={avatar} alt="current" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="text-[8px] md:text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Active Identity</p>
                    <p className="text-[9px] md:text-[10px] font-bold text-[var(--color-text-primary)]">Selection pending sync</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAvatarModalOpen(false)}
                  className="w-full sm:w-auto px-6 py-2.5 md:py-3 bg-slate-900 text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                >
                  Confirm Selection
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <NexusModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
};

export default SettingsPage;
