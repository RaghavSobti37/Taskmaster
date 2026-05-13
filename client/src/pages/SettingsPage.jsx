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
import { Badge, NexusModal, NexusDropdown } from '../components/ui';
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
    <div className="space-y-8 pb-24">
      {/* Premium Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--color-action-primary)]/10 rounded-xl text-[var(--color-action-primary)] shadow-sm border border-[var(--color-action-primary)]/10">
              <Settings size={20} />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-[var(--color-text-primary)] uppercase">
              Settings
            </h1>
          </div>
          <p className="text-[10px] md:text-xs font-medium text-[var(--color-text-muted)] ml-12 md:ml-14">Manage your profile and account preferences.</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-bg-border)] shadow-sm self-start md:self-center">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">Account Secure</span>
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
          <div className="px-6 md:px-10 py-4 md:py-6 border-b border-[var(--color-bg-border)] bg-gradient-to-r from-[var(--color-bg-workspace)] to-transparent flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4 scale-[0.65] origin-left">
              <div className="p-2 md:p-2.5 bg-blue-500/10 rounded-lg md:rounded-xl text-blue-500 shadow-sm">
                <User size={16} md:size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black tracking-tight text-[var(--color-text-primary)] uppercase">My Profile</h3>
                <p className="hidden sm:block text-[10px] text-[var(--color-text-muted)] font-medium">Update your personal information.</p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-10 space-y-8 md:space-y-10">
            <div className="scale-[0.7] origin-top-left space-y-8">
              {/* Avatar Profile Interaction */}
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-[var(--color-bg-workspace)]/40 p-6 md:p-8 rounded-[1.5rem] border border-[var(--color-bg-border)] group">
                <div
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="relative cursor-pointer group/avatar"
                >
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-[1rem] md:rounded-2xl bg-[var(--color-bg-surface)] border-2 border-blue-500/20 flex items-center justify-center overflow-hidden shadow-2xl group-hover/avatar:border-blue-500/50 transition-all">
                    {avatar ? (
                      <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} md:size={30} className="text-[var(--color-text-muted)]" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-all">
                      <Camera size={14} className="text-white" />
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1 bg-blue-500 text-white rounded-md md:rounded-lg shadow-lg border-2 border-[var(--color-bg-surface)]">
                    <Sparkles size={8} md:size={10} />
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left space-y-1">
                  <h4 className="text-sm md:text-base font-black text-[var(--color-text-primary)] uppercase tracking-tight">Profile Picture</h4>
                  <p className="text-[8px] md:text-[9px] text-[var(--color-text-muted)] font-medium">User: {name || 'New User'}</p>
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="mt-1.5 text-[7px] md:text-[8px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors bg-blue-500/5 px-3 py-1.5 rounded-md border border-blue-500/10"
                  >
                    Change Picture
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] ml-1">Full Name</label>
                  <div className="relative group">
                    <User size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Enter Name"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] ml-1">Phone Number</label>
                  <div className="flex gap-2">
                      <NexusDropdown
                        options={[{ value: '+91', label: '+91 (IN)' }]}
                        value="+91"
                        onChange={() => {}}
                        variant="compact"
                        className="w-20"
                      />
                    <div className="relative flex-1 group">
                      <Smartphone size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="text"
                        value={phone.replace(/^\+91\s*/, '')}
                        onChange={(e) => setPhone('+91 ' + e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        placeholder="98765 43210"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-[var(--color-bg-border)]">
                <CKDropdown
                  label="Account Role"
                  options={roleOptions}
                  value={role}
                  onChange={setRole}
                  disabled={user?.role !== 'admin'}
                />
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] ml-1">Email Address</label>
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

              <div className="pt-6 border-t border-[var(--color-bg-border)] space-y-4">
                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] ml-1">My Teams</label>
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
                            px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border
                            ${isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-105'
                              : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:border-blue-500/50'}
                          `}
                        >
                          {team.name}
                          {isSelected && <CheckCircle2 size={10} className="inline-block ml-2 text-blue-400" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Preferences */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
              <h3 className="text-base font-black tracking-tight uppercase scale-[0.6] origin-left">Preferences</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="scale-[0.7] origin-top-left space-y-4">
                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between p-5 bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)] shadow-sm hover:border-blue-500/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg border transition-all ${theme === 'dark' ? 'bg-slate-900 border-white/5 text-blue-400' : 'bg-white border-slate-200 text-orange-400'}`}>
                      {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-[var(--color-text-primary)]">Dark Mode</p>
                      <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-tight">Toggle dark appearance</p>
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
                      <p className="text-xs font-black text-[var(--color-text-primary)]">Notifications</p>
                      <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-tight">Manage browser alerts</p>
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
              <h3 className="text-base font-black tracking-tight uppercase scale-[0.6] origin-left">Change Password</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="scale-[0.7] origin-top-left space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Current Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          </motion.section>
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
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-tight">Sync profile & password</p>
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
