import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  User,
  Smartphone,
  CalendarDays,
  Camera,
  X,
  Sparkles,
  Key,
  Shield,
  Eye,
  EyeOff,
  Compass,
  Bot,
  Smile,
  Palette,
  Shapes,
  Users,
  Gamepad2,
  Ghost,
  Heart,
} from 'lucide-react';
import { Input, Button, Badge } from '../../../components/ui';
import { ModalShell } from '../../../components/ui/modals';
import { useAuth } from '../../../contexts/AuthContext';
import { getDepartmentName } from '../../../utils/departmentPermissions';
import { formatDobInput, parseDobInput, getActiveDobPlaceholder } from '../../../utils/dateDisplay';
import { validatePasswordStrength } from '../../../utils/passwordValidation';
import PasswordRequirements from '../../../components/auth/PasswordRequirements';
import {
  AVATAR_CATALOG,
  AVATAR_CATEGORY_IDS,
  AVATAR_TOTAL_COUNT,
} from '../../../constants/avatarCatalog';
import { useUnsavedChanges, stableJsonEqual } from '../../../hooks/useUnsavedChanges';
import { useNavigate } from 'react-router-dom';

const formatProfileDob = (value) => formatDobInput(value);

const CATEGORY_ICONS = {
  'Cartoon Male': User,
  'Cartoon Female': Heart,
  Adventure: Compass,
  Avataaars: Sparkles,
  'Big Smile': Smile,
  Bots: Bot,
  'Fun Emoji': Smile,
  Lorelei: Ghost,
  Micah: Users,
  'Mini Avatars': Gamepad2,
  Notionists: User,
  'Open Peeps': Users,
  Personas: Users,
  'Pixel Art': Gamepad2,
  Thumbs: Heart,
  Shapes: Shapes,
};

export default function ProfileTab() {
  const navigate = useNavigate();
  const { user, applySessionUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [phone, setPhone] = useState(user?.phone || '+91 ');
  const [dateOfBirth, setDateOfBirth] = useState(formatProfileDob(user?.dateOfBirth));
  const [dobError, setDobError] = useState('');
  const [teams, setTeams] = useState(() => (user?.teams ? user.teams.map((t) => ({ value: t, label: t })) : []));
  const [allTeams, setAllTeams] = useState([]);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(AVATAR_CATEGORY_IDS[0]);

  const activeAvatars = AVATAR_CATALOG[activeCategory] || [];

  useEffect(() => {
    axios
      .get('/api/teams')
      .then((res) => setAllTeams(res.data))
      .catch(console.error);
  }, []);

  const applyUserToForm = useCallback((source) => {
    if (!source) return;
    setName(source.name || '');
    setAvatar(source.avatar || '');
    setPhone(source.phone || '+91 ');
    setDateOfBirth(formatProfileDob(source?.dateOfBirth));
    setDobError('');
    setTeams(source.teams ? source.teams.map((t) => ({ value: t, label: t })) : []);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  }, []);

  useEffect(() => {
    applyUserToForm(user);
  }, [user, applyUserToForm]);

  const profileSnapshot = useMemo(
    () => ({
      name,
      avatar,
      phone,
      dateOfBirth,
      teams: teams.map((t) => (typeof t === 'object' ? t.value : t)),
      password,
      newPassword,
    }),
    [name, avatar, phone, dateOfBirth, teams, password, newPassword]
  );

  const savedProfileSnapshot = useMemo(
    () =>
      user
        ? {
            name: user.name || '',
            avatar: user.avatar || '',
            phone: user.phone || '+91 ',
            dateOfBirth: formatProfileDob(user?.dateOfBirth),
            teams: user.teams || [],
            password: '',
            newPassword: '',
          }
        : null,
    [user]
  );

  const mustChangePassword = Boolean(user?.mustChangePassword);
  const canSkipCurrentPassword = Boolean(
    user?.authProviders?.canSetPasswordWithoutCurrent || mustChangePassword
  );

  const hasProfileChanges = useMemo(() => {
    if (!savedProfileSnapshot) return false;
    if (mustChangePassword) {
      const { password: _p, newPassword: _n, ...draft } = profileSnapshot;
      const { password: _sp, newPassword: _sn, ...saved } = savedProfileSnapshot;
      return !stableJsonEqual(draft, saved);
    }
    return !stableJsonEqual(profileSnapshot, savedProfileSnapshot);
  }, [profileSnapshot, savedProfileSnapshot, mustChangePassword]);

  const handleSaveRequiredPassword = async () => {
    setPasswordError('');
    setSaveError('');

    if (!newPassword || !confirmPassword) {
      setPasswordError('Enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    const error = validatePasswordStrength(newPassword);
    if (error) {
      setPasswordError(error);
      return;
    }

    setPasswordSaving(true);
    try {
      const { data: updatedUser } = await axios.post('/api/auth/change-required-password', {
        newPassword,
        confirmPassword,
      });
      applySessionUser(updatedUser);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleUpdateProfile = async () => {
    setPasswordError('');
    setSaveError('');
    setDobError('');
    if (mustChangePassword && newPassword) {
      setPasswordError('Use "Save new password" below before saving other profile changes.');
      return;
    }
    if (newPassword && !canSkipCurrentPassword && !password) {
      setPasswordError('Enter your current password to set a new password.');
      return;
    }
    if (newPassword) {
      const error = validatePasswordStrength(newPassword);
      if (error) {
        setPasswordError(error);
        return;
      }
    }
    const dobParsed = parseDobInput(dateOfBirth);
    if (!dobParsed.ok) {
      setDobError(dobParsed.error);
      return;
    }
    setLoading(true);
    try {
      const teamStrings = teams.map((t) => (typeof t === 'object' ? t.value : t));
      const payload = {
        name,
        avatar,
        phone,
        teams: teamStrings,
        dateOfBirth: dobParsed.value,
      };
      if (newPassword && (password || canSkipCurrentPassword)) {
        if (password) payload.currentPassword = password;
        payload.newPassword = newPassword;
      }
      const { data: updatedUser } = await axios.put('/api/users/profile', payload);
      applySessionUser(updatedUser);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarSelect = async (url) => {
    setAvatar(url);
    setSaveError('');
    setAvatarSaving(true);
    try {
      const { data: updatedUser } = await axios.put('/api/users/profile', { avatar: url });
      applySessionUser(updatedUser);
      setIsAvatarModalOpen(false);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save avatar');
    } finally {
      setAvatarSaving(false);
    }
  };

  useUnsavedChanges({
    hasChanges: hasProfileChanges,
    onSave: handleUpdateProfile,
    onCancel: () => applyUserToForm(user),
    isSaving: loading,
  });

  const passwordToggle = (visible, setVisible) => (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      aria-label={visible ? 'Hide password' : 'Show password'}
    >
      {visible ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
     

      <section className="border-b border-[var(--color-bg-border)] pb-8 space-y-8">
        <div className="flex items-center gap-6 p-4 rounded-[var(--radius-atomic)] bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] min-w-0">
          <div className="relative group cursor-pointer shrink-0" onClick={() => setIsAvatarModalOpen(true)}>
            <div className="w-16 h-16 rounded-[var(--radius-atomic)] border-2 border-[var(--color-bg-border)] overflow-hidden bg-[var(--color-bg-secondary)] group-hover:border-[var(--color-action-primary)] transition-all">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-4 opacity-20" />
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-[var(--radius-atomic)]">
              <Camera size={16} className="text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="tm-data-primary text-sm font-black uppercase tracking-tight truncate">{name || 'User'}</h4>
            <p className="text-xs tm-data-meta font-bold uppercase tracking-widest truncate">
              {user?.email}
            </p>
            <Button variant="ghost" size="xs" className="mt-2" onClick={() => setIsAvatarModalOpen(true)}>
              Change Avatar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={User}
            className="!text-xs"
          />
          <Input
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 XXXXX-XXXXX"
            icon={Smartphone}
            className="!text-xs"
          />
          <Input
            type="text"
            inputMode="numeric"
            label="Date of Birth"
            placeholder={getActiveDobPlaceholder()}
            value={dateOfBirth}
            onChange={(e) => {
              setDateOfBirth(e.target.value);
              setDobError('');
            }}
            icon={CalendarDays}
            className="!text-xs"
          />
          {dobError && <p className="text-xs text-rose-500 font-medium -mt-4">{dobError}</p>}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
              Department / Role
            </label>
            <p className="text-sm text-[var(--color-text-primary)] px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)]">
              {getDepartmentName(user)}
            </p>
            <p className="text-[9px] text-[var(--color-text-muted)] ml-1">
              Contact an administrator to change your role.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            {canSkipCurrentPassword ? (
              <p className="text-xs text-[var(--color-text-secondary)] font-medium ml-1">
                {mustChangePassword
                  ? 'Your account uses a temporary password. Set a new password below — current password not required.'
                  : 'Your account uses Google sign-in. Set a password below to also sign in with your email.'}
              </p>
            ) : (
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                label="Current Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={Key}
                className="!text-xs"
                endAdornment={passwordToggle(showCurrentPassword, setShowCurrentPassword)}
              />
            )}
            <Input
              type={showNewPassword ? 'text' : 'password'}
              label={canSkipCurrentPassword ? 'Password' : 'New Password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              icon={Shield}
              className="!text-xs"
              endAdornment={passwordToggle(showNewPassword, setShowNewPassword)}
            />
            {mustChangePassword && (
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={Shield}
                className="!text-xs"
                endAdornment={passwordToggle(showConfirmPassword, setShowConfirmPassword)}
              />
            )}
            <div className="p-3 rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
              <PasswordRequirements password={newPassword} />
            </div>
            {mustChangePassword && (
              <Button
                type="button"
                onClick={handleSaveRequiredPassword}
                disabled={passwordSaving || !newPassword || !confirmPassword}
                className="w-full sm:w-auto"
              >
                {passwordSaving ? 'Saving…' : 'Save new password'}
              </Button>
            )}
            {passwordError && <p className="text-xs text-rose-500 font-medium">{passwordError}</p>}
            {saveError && <p className="text-xs text-rose-500 font-medium">{saveError}</p>}
          </div>
        </div>
      </section>

      <ModalShell isOpen={isAvatarModalOpen} onClose={() => setIsAvatarModalOpen(false)} size="xl" zIndex={200}>
        <header className="p-4 sm:p-6 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)] shrink-0 gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
              <Sparkles size={18} className="text-blue-500" /> Choose an Avatar
            </h3>
            <p className="text-[9px] text-[var(--color-text-muted)] mt-1 font-bold uppercase tracking-wider">
              {AVATAR_TOTAL_COUNT} avatars · {AVATAR_CATEGORY_IDS.length} categories
            </p>
          </div>
          <Button variant="ghost" size="xs" onClick={() => setIsAvatarModalOpen(false)}>
            <X size={18} />
          </Button>
        </header>
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0 max-h-[min(70vh,520px)]">
          <aside className="sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50 overflow-y-auto custom-scrollbar p-2 sm:p-3 flex sm:flex-col gap-1 flex-row flex-wrap sm:flex-nowrap">
            {AVATAR_CATEGORY_IDS.map((catId) => {
              const Icon = CATEGORY_ICONS[catId] || Palette;
              const isActive = activeCategory === catId;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setActiveCategory(catId)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[9px] font-black uppercase tracking-wide transition-all w-full sm:w-auto sm:min-w-0 ${
                    isActive
                      ? 'bg-[var(--color-action-primary)]/15 text-[var(--color-action-primary)] border border-[var(--color-action-primary)]/30'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] border border-transparent'
                  }`}
                >
                  <Icon size={12} className="shrink-0" />
                  <span className="truncate flex-1">{catId}</span>
                  <Badge variant="slate" className="!text-[7px] !py-0 !px-1 shrink-0 tabular-nums">
                    {AVATAR_CATALOG[catId].length}
                  </Badge>
                </button>
              );
            })}
          </aside>
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
              {activeCategory} · {activeAvatars.length} options
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2.5 sm:gap-3">
              {activeAvatars.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => handleAvatarSelect(url)}
                  disabled={avatarSaving}
                  className={`aspect-square rounded-[var(--radius-atomic)] border-2 overflow-hidden transition-all hover:scale-105 ${
                    avatar === url
                      ? 'border-[var(--color-action-primary)] ring-2 ring-[var(--color-action-primary)]/30'
                      : 'border-[var(--color-bg-border)] opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover bg-[var(--color-bg-secondary)]" loading="lazy" />
                </button>
              ))}
            </div>
          </main>
        </div>
        {avatarSaving && (
          <p className="px-4 pb-3 text-[10px] text-[var(--color-text-muted)]">Saving avatar…</p>
        )}
        <footer className="px-4 py-2 border-t border-[var(--color-bg-border)] text-[8px] text-[var(--color-text-muted)] text-center">
          Cartoon avatars by Ashwinvalento · DiceBear styles under their respective licenses
        </footer>
      </ModalShell>

      <section className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#126d5e]/10 text-[#126d5e]">
            <Compass size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Product tour</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
              Replay the guided walkthrough of navigation, inbox, tasks, and app install tips.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => {
                if (!user?._id) return;
                navigate('/dashboard');
                window.dispatchEvent(new CustomEvent('coreknot:replay-onboarding'));
              }}
            >
              Replay tutorial
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
