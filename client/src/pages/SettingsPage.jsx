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
import { Badge, NexusModal, NexusDropdown, PageHeader, PageContainer, Card } from '../components/ui';
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
  const [teams, setTeams] = useState(() => {
    return user?.teams ? user.teams.map(t => ({ value: t, label: t })) : [];
  });
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

  const isChanged = () => {
    if (!user) return false;
    const teamStrings = teams.map(t => typeof t === 'object' ? t.value : t);
    const initialTeamStrings = user.teams || [];

    const teamsMatch = teamStrings.length === initialTeamStrings.length &&
      teamStrings.every(t => initialTeamStrings.includes(t));

    return (
      name !== user.name ||
      avatar !== user.avatar ||
      phone !== (user.phone || '+91 ') ||
      (user.role === 'admin' && role !== user.role) ||
      !teamsMatch ||
      (password && newPassword)
    );
  };

  const hasChanges = isChanged();

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      // Map teams back to string array for backend compatibility
      const teamStrings = teams.map(t => typeof t === 'object' ? t.value : t);
      const payload = { name, avatar, phone, teams: teamStrings };
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
        message: err.response?.data?.error || 'Failed to update your profile. Please try again.',
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
    <PageContainer maxWidth="1000px">
      <PageHeader
        icon={Settings}
        title="Settings"
        subtitle="Manage your profile and account settings."
      />

      <div className="grid grid-cols-1 gap-10">
        {/* Profile Section */}
        <Card className="overflow-hidden">
          <div className="px-5 md:px-8 py-3.5 border-b border-[var(--color-bg-border)] bg-gradient-to-r from-[var(--color-bg-workspace)] to-transparent flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500 shadow-sm border border-blue-500/20">
                <UserSquare2 size={8} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[9px] font-black tracking-tighter text-[var(--color-text-primary)] uppercase italic">Profile</h3>
                <p className="hidden sm:block text-[6px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest">Update your personal details</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-full text-[5px] font-black uppercase tracking-[0.2em] text-blue-500">
              Verified
            </div>
          </div>

          <div className="p-6 md:p-10">
            <div className="max-w-4xl space-y-10">
              {/* Avatar Profile Interaction */}
              <div className="flex flex-col md:flex-row items-center gap-8 bg-[var(--color-bg-workspace)]/40 p-6 rounded-[2rem] border border-[var(--color-bg-border)] group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
                <div
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="relative cursor-pointer group/avatar"
                >
                  <div className="w-8 h-8 rounded-2xl bg-[var(--color-bg-surface)] border-2 border-blue-500/20 flex items-center justify-center overflow-hidden shadow-2xl group-hover/avatar:border-blue-500/50 transition-all">
                    {avatar ? (
                      <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={12} className="text-[var(--color-text-muted)]" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-all">
                      <Camera size={8} className="text-white" />
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-0.5 bg-blue-500 text-white rounded-lg shadow-lg border-2 border-[var(--color-bg-surface)]">
                    <Sparkles size={8} />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left space-y-0.5">
                  <h4 className="text-[8px] font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">Avatar Selection</h4>
                  <p className="text-[5px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest">Profile Name: {name || 'Anonymous'}</p>
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="mt-2 text-[6px] font-black uppercase tracking-widest text-blue-500 hover:text-white hover:bg-blue-600 transition-all bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10 active:scale-95"
                  >
                    Change Avatar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[6px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] ml-1">Full Name</label>
                  <div className="relative group">
                    <User size={6} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[6px] font-black outline-none focus:border-blue-500/50 transition-all shadow-inner"
                      placeholder="Enter Full Name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[6px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] ml-1">Phone Number</label>
                  <div className="flex gap-3">

                    <div className="relative flex-1 group">
                      <Smartphone size={6} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="text"
                        value={phone.replace(/^\+91\s*/, '')}
                        onChange={(e) => setPhone('+91 ' + e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[6px] font-black outline-none focus:border-blue-500/50 transition-all shadow-inner"
                        placeholder="98765 43210"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-[var(--color-bg-border)]">
                <div>
                  <CKDropdown
                    label="Account Role"
                    options={roleOptions}
                    value={role}
                    onChange={setRole}
                    disabled={user?.role !== 'admin'}
                    className="!text-[8px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[6px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] ml-1">Email Address</label>
                  <div className="relative">
                    <Mail size={7} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] opacity-50" />
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)]/50 border border-[var(--color-bg-border)] rounded-xl text-[6px] font-bold opacity-50 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-[var(--color-bg-border)] space-y-5">
                <label className="text-[6px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] ml-1">Assigned Teams</label>
                <div className="flex flex-wrap gap-3">
                  {[...allTeams]
                    .sort((a, b) => {
                      const aSelected = teams.some(t => (typeof t === 'object' ? t.value : t) === a.name);
                      const bSelected = teams.some(t => (typeof t === 'object' ? t.value : t) === b.name);
                      if (aSelected && !bSelected) return -1;
                      if (!aSelected && bSelected) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map(team => {
                      const isSelected = teams.some(t => (typeof t === 'object' ? t.value : t) === team.name);
                      return (
                        <button
                          key={team._id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setTeams(teams.filter(t => (typeof t === 'object' ? t.value : t) !== team.name));
                            } else {
                              setTeams([...teams, { value: team.name, label: team.name }]);
                            }
                          }}
                          className={`
                            px-3 py-1.5 rounded-lg text-[5px] font-black uppercase tracking-widest transition-all border
                            ${isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105'
                              : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-blue-500/50'}
                          `}
                        >
                          {team.name}
                          {isSelected && <CheckCircle2 size={6} className="inline-block ml-1 text-blue-400" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Preferences */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                  <Palette size={8} />
                </div>
                <h3 className="text-[8px] font-black tracking-tight uppercase italic">App Preferences</h3>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-6">
                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-[var(--color-bg-workspace)] rounded-[1.25rem] border border-[var(--color-bg-border)] shadow-inner hover:border-blue-500/20 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border transition-all ${theme === 'dark' ? 'bg-slate-900 border-white/10 text-blue-400' : 'bg-white border-slate-200 text-orange-400'}`}>
                      {theme === 'dark' ? <Moon size={10} /> : <Sun size={10} />}
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-[var(--color-text-primary)]">Dark Mode</p>
                      <p className="text-[5px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-0.5">Toggle theme</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`w-7 h-3.5 rounded-full transition-all relative ${theme === 'dark' ? 'bg-blue-600 shadow-inner' : 'bg-slate-200 shadow-inner'}`}
                  >
                    <motion.div
                      layout
                      className="absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-xl"
                      animate={{ x: theme === 'dark' ? 14 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Notifications Toggle */}
                <div className="flex items-center justify-between p-6 bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)] shadow-inner hover:border-emerald-500/20 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl border transition-all ${notificationsEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      <Bell size={12} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-[var(--color-text-primary)]">Notifications</p>
                      <p className="text-[6px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-0.5">Receive alerts</p>
                    </div>
                  </div>
                  <button
                    onClick={requestNotificationPermission}
                    className={`w-8 h-4 rounded-full transition-all relative ${notificationsEnabled ? 'bg-emerald-500 shadow-inner' : 'bg-slate-200 shadow-inner'}`}
                  >
                    <motion.div
                      layout
                      className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-white shadow-xl"
                      animate={{ x: notificationsEnabled ? 16 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Security Section */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-rose-500/10 rounded-xl text-rose-500 border border-rose-500/20">
                  <Lock size={8} />
                </div>
                <h3 className="text-[8px] font-black tracking-tight uppercase italic">Password Settings</h3>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[6px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Current Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[6px] font-black outline-none focus:border-rose-500/50 transition-all shadow-inner"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[6px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-5 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[6px] font-black outline-none focus:border-rose-500/50 transition-all shadow-inner"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Floating Action Bar */}
      <AnimatePresence>
        {(hasChanges || success) && (
          <motion.div
            initial={{ y: 100, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: 100, x: '-50%', opacity: 0 }}
            className="fixed bottom-8 left-1/2 z-50 w-[90%] max-w-4xl"
          >
            <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-4 px-4">
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-widest"
                    >
                      <CheckCircle2 size={16} /> All Changes Saved
                    </motion.div>
                  ) : (
                    <motion.div
                      key="prompt"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Save size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-white uppercase tracking-widest">Unsaved Changes</p>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-tight">Update profile and password</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="flex items-center justify-center gap-3 bg-white text-slate-900 px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-100 disabled:opacity-50 transition-all active:scale-95 shadow-xl"
              >
                {loading ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <h3 className="text-base md:text-xl font-black uppercase tracking-tight">Avatar Gallery</h3>
                    <p className="hidden sm:block text-[9px] md:text-[10px] font-bold text-blue-400 uppercase tracking-widest">Select your profile picture</p>
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
                    <p className="text-[8px] md:text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Selected Avatar</p>
                    <p className="text-[9px] md:text-[10px] font-bold text-[var(--color-text-primary)]">Save changes to update</p>
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
    </PageContainer>
  );
};

export default SettingsPage;
