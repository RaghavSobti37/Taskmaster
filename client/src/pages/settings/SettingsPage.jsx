import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Bell, Shield, ShieldCheck, Palette, Save, Globe, Lock,
  Sun, Moon, Smartphone, Mail, Users, Eye, EyeOff, CheckCircle2,
  AlertCircle, Camera, Layers, Settings, ShieldAlert, ChevronDown,
  ChevronRight, X, Sparkles, Cpu, Gamepad2, Shapes, UserSquare2,
  Key, Target, Zap
} from 'lucide-react';
import { 
  Badge, 
  NexusModal, 
  NexusDropdown, 
  PageHeader, 
  PageContainer, 
  Card, 
  Button, 
  Input 
} from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import CKDropdown from '../../components/ui/CKDropdown';
import axios from 'axios';

const StatusCard = ({ label, value, icon: Icon, variant = 'slate' }) => (
  <Card className="p-3 flex items-center gap-4 border-l-4" style={{ borderLeftColor: `var(--color-pastel-${variant}-text)` }}>
    <div className={`p-2 rounded-lg bg-[var(--color-pastel-${variant}-bg)] text-[var(--color-pastel-${variant}-text)]`}>
      <Icon size={16} />
    </div>
    <div>
      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-lg font-black tracking-tight leading-none">{value}</p>
    </div>
  </Card>
);

const SettingsPage = () => {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState(user?.name || '');
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
    { value: 'user', label: 'Member' },
    { value: 'admin', label: 'Administrator' },
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

  const hasChanges = useMemo(() => {
    if (!user) return false;
    const teamStrings = teams.map(t => typeof t === 'object' ? t.value : t);
    const initialTeamStrings = user.teams || [];
    const teamsMatch = teamStrings.length === initialTeamStrings.length &&
      teamStrings.every(t => initialTeamStrings.includes(t));

    return (
      name !== user.name ||
      avatar !== user.avatar ||
      phone !== (user.phone || '+91 ') ||
      (password && newPassword) ||
      !teamsMatch
    );
  }, [name, avatar, phone, teams, password, newPassword, user]);

  const handleUpdateProfile = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const teamStrings = teams.map(t => typeof t === 'object' ? t.value : t);
      const payload = { name, avatar, phone, teams: teamStrings };
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
        message: err.response?.data?.error || 'Failed to update profile.',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Account Settings"
        subtitle="Manage your personal profile and preferences."
      />

      {/* Analytical Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard label="Status" value="ACTIVE" icon={Zap} variant="mint" />
        <StatusCard label="Security" value="SECURE" icon={ShieldCheck} variant="info" />
        <StatusCard label="Teams" value={teams.length} icon={Users} variant="apricot" />
        <StatusCard label="Last Sync" value="REALTIME" icon={Globe} variant="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Progress Analytics */}
          <Card className="overflow-hidden">
            <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
               <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 <Target size={14} className="text-amber-500" /> Progress Analytics
               </h3>
               <Badge variant="warning">Level {user?.level || 1}</Badge>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                  Level {user?.level || 1}
                </span>
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                  Level {(user?.level || 1) + 1}
                </span>
              </div>
              <div className="w-full h-3 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden border border-[var(--color-bg-border)] relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, ((user?.exp || 0) - (Math.pow((user?.level || 1) - 1, 2) * 100)) / ((Math.pow(user?.level || 1, 2) * 100) - (Math.pow((user?.level || 1) - 1, 2) * 100)) * 100))}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                />
              </div>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-3 text-center uppercase tracking-widest">
                {user?.exp || 0} / {Math.pow((user?.level || 1), 2) * 100} XP
              </p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
               <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 <User size={14} className="text-blue-500" /> User Profile
               </h3>
            </div>
            <div className="p-6 space-y-8">
              <div className="flex items-center gap-6 p-4 rounded-[var(--radius-atomic)] bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)]">
                 <div className="relative group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
                    <div className="w-16 h-16 rounded-[var(--radius-atomic)] border-2 border-[var(--color-bg-border)] overflow-hidden bg-[var(--color-bg-secondary)] group-hover:border-[var(--color-action-primary)] transition-all">
                       {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <User className="w-full h-full p-4 opacity-20" />}
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-[var(--radius-atomic)]">
                       <Camera size={16} className="text-white" />
                    </div>
                 </div>
                 <div>
                    <h4 className="text-xs font-black uppercase tracking-tight">{name || 'User'}</h4>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest">{user?.email}</p>
                    <Button variant="ghost" size="xs" className="mt-2" onClick={() => setIsAvatarModalOpen(true)}>Change Avatar</Button>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} icon={User} className="!text-xs" />
                 <Input label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} icon={Smartphone} className="!text-xs" />
              </div>

              <div className="pt-4 border-t border-[var(--color-bg-border)]">
                 <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-3 block">Assigned Teams</label>
                 <div className="flex flex-wrap gap-2">
                    {allTeams.map(team => {
                       const isSelected = teams.some(t => (typeof t === 'object' ? t.value : t) === team.name);
                       return (
                         <Badge 
                           key={team._id} 
                           variant={isSelected ? 'success' : 'slate'} 
                           className="cursor-pointer hover:scale-105 transition-transform"
                           onClick={() => {
                             if (isSelected) {
                               setTeams(teams.filter(t => (typeof t === 'object' ? t.value : t) !== team.name));
                             } else {
                               setTeams([...teams, { value: team.name, label: team.name }]);
                             }
                           }}
                         >
                           {team.name}
                         </Badge>
                       );
                    })}
                 </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <Card className="p-4 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
               <Palette size={14} /> Global Preferences
            </h4>
            <div className="space-y-2">
               <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                  <div className="flex items-center gap-3">
                     {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                     <span className="text-[10px] font-bold uppercase tracking-wider">Dark Mode</span>
                  </div>
                  <button onClick={toggleTheme} className={`w-8 h-4 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'}`}>
                     <motion.div layout animate={{ x: theme === 'dark' ? 16 : 0 }} className="w-4 h-4 bg-white rounded-full shadow-lg" />
                  </button>
               </div>
               <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                  <div className="flex items-center gap-3">
                     <Bell size={14} />
                     <span className="text-[10px] font-bold uppercase tracking-wider">Notifications</span>
                  </div>
                  <button className="w-8 h-4 rounded-full bg-emerald-500 relative">
                     <div className="w-4 h-4 bg-white rounded-full shadow-lg ml-4" />
                  </button>
               </div>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
               <Lock size={14} /> Password & Security
            </h4>
            <div className="space-y-3">
               <Input type="password" label="Current Password" value={password} onChange={e => setPassword(e.target.value)} icon={Key} className="!text-[10px]" />
               <Input type="password" label="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} icon={Shield} className="!text-[10px]" />
            </div>
          </Card>
        </aside>
      </div>

      {/* Floating Sync Bar */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-lg"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                     <Target size={16} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Unsaved Changes</p>
                     <p className="text-[8px] text-white/40 font-bold uppercase mt-1">You have uncommitted edits to your profile</p>
                  </div>
               </div>
               <Button size="sm" onClick={handleUpdateProfile} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Modal */}
      <AnimatePresence>
        {isAvatarModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAvatarModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-4xl bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <header className="p-6 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
                 <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                   <Sparkles size={18} className="text-blue-500" /> Choose an Avatar
                 </h3>
                 <Button variant="ghost" size="xs" onClick={() => setIsAvatarModalOpen(false)}><X size={18} /></Button>
              </header>
              <div className="flex-1 overflow-hidden flex">
                 <aside className="w-48 bg-[var(--color-bg-secondary)] border-r border-[var(--color-bg-border)] p-4 space-y-1">
                    {categories.map(cat => (
                      <button 
                        key={cat.id} 
                        onClick={() => setActiveCategory(cat.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeCategory === cat.id ? 'bg-[var(--color-action-primary)] text-white' : 'hover:bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]'}`}
                      >
                        <cat.icon size={12} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{cat.id}</span>
                      </button>
                    ))}
                 </aside>
                 <main className="flex-1 p-6 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    {avatarCategories[activeCategory].map((url, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => { setAvatar(url); setIsAvatarModalOpen(false); }}
                        className={`aspect-square rounded-xl border-2 overflow-hidden transition-all hover:scale-105 ${avatar === url ? 'border-[var(--color-action-primary)]' : 'border-[var(--color-bg-border)] opacity-60 hover:opacity-100'}`}
                      >
                        <img src={url} className="w-full h-full object-cover" />
                      </button>
                    ))}
                 </main>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <NexusModal isOpen={modalConfig.isOpen} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} title={modalConfig.title} message={modalConfig.message} type={modalConfig.type} />
    </PageContainer>
  );
};

export default SettingsPage;
