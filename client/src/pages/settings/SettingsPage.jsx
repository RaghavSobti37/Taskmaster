import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Bell, Shield, Palette, Save, Lock,
  Sun, Moon, Smartphone, Users, Camera, X, Sparkles, Cpu, Gamepad2, Shapes, UserSquare2,
  Key, Target, Clock, FileText, Upload, CalendarDays, Receipt
} from 'lucide-react';
import {
  Badge,
  NexusModal,
  ModalShell,
  PageHeader,
  PageContainer,
  Card,
  Button,
  Input
} from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import axios from 'axios';
import { useAttendance, useApplyLeave, useLeaveRequests, useDepartments, useDepartmentChangeRequests, useSubmitDepartmentChange } from '../../hooks/useTaskmasterQueries';
import { uploadFiles } from '../../utils/uploadthing';
import {
  getNotificationPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  setPushPreferenceEnabled
} from '../../utils/notifications';

const WEAK_PASSWORDS = new Set([
  '1234', '12345', '123456', '1234567', '12345678', '123456789', '1234567890',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123', 'admin', 'admin123',
  'letmein', 'welcome', 'monkey', 'dragon', 'master', 'abc123', 'iloveyou',
  'sunshine', 'princess', 'football', 'baseball', 'trustno1', '111111', '000000',
]);

const validatePasswordStrength = (password) => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number';
  }
  const normalized = password.toLowerCase().trim();
  if (WEAK_PASSWORDS.has(normalized)) {
    return 'Password is too weak. Please choose a stronger password';
  }
  if (/^(.)\1+$/.test(password) || /^(\d+)$/.test(password)) {
    return 'Password is too weak. Please choose a stronger password';
  }
  return null;
};

const formatDateInput = (value) => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

const getAttendanceRowClass = (row) => {
  if (row.onLeave) return 'bg-red-500/15 text-red-900 dark:text-red-100';
  if (row.isHalfDay) return 'bg-yellow-500/15 text-yellow-900 dark:text-yellow-100';
  return '';
};

const SettingsPage = () => {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [phone, setPhone] = useState(user?.phone || '+91 ');
  const [dateOfBirth, setDateOfBirth] = useState(formatDateInput(user?.dateOfBirth));
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
  const [leaveFromDate, setLeaveFromDate] = useState('');
  const [leaveToDate, setLeaveToDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSuccessMessage, setLeaveSuccessMessage] = useState('');
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const invoiceFileRef = useRef(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    getNotificationPushStatus().then(({ permission, subscribed, enabled }) => {
      setPushPermission(permission);
      setPushEnabled(enabled || subscribed);
    });
  }, []);

  const handlePushToggle = async () => {
    if (pushPermission === 'denied') return;
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
      } else {
        setPushPreferenceEnabled(true);
        const ok = await subscribeToPush();
        const status = await getNotificationPushStatus();
        setPushPermission(status.permission);
        setPushEnabled(ok && status.subscribed);
      }
    } finally {
      setPushLoading(false);
    }
  };

  const { data: myAttendance = [] } = useAttendance({ mine: true }, !!user);
  const { data: myLeaveRequests = [] } = useLeaveRequests({}, !!user);
  const applyLeave = useApplyLeave();
  const { data: departments = [] } = useDepartments();
  const { data: deptRequests = [] } = useDepartmentChangeRequests(!!user);
  const submitDeptChange = useSubmitDepartmentChange();
  const [requestedDeptId, setRequestedDeptId] = useState('');

  const pendingLeaveCount = useMemo(
    () => myLeaveRequests.filter((r) => r.status === 'pending').length,
    [myLeaveRequests]
  );

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

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setAvatar(user.avatar || '');
    setPhone(user.phone || '+91 ');
    setDateOfBirth(formatDateInput(user.dateOfBirth));
    setTeams(user.teams ? user.teams.map(t => ({ value: t, label: t })) : []);
  }, [user]);

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
      dateOfBirth !== formatDateInput(user.dateOfBirth) ||
      (password && newPassword) ||
      !teamsMatch
    );
  }, [name, avatar, phone, dateOfBirth, teams, password, newPassword, user]);

  const handleUpdateProfile = async () => {
    if (password && newPassword) {
      const passwordError = validatePasswordStrength(newPassword);
      if (passwordError) {
        alert(passwordError);
        return;
      }
    }

    setLoading(true);
    setSuccess(false);
    try {
      const teamStrings = teams.map(t => typeof t === 'object' ? t.value : t);
      const payload = { name, avatar, phone, teams: teamStrings, dateOfBirth: dateOfBirth || null };
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

  const handleApplyLeave = async () => {
    try {
      await applyLeave.mutateAsync({ fromDate: leaveFromDate, toDate: leaveToDate, reason: leaveReason });
      setLeaveSuccessMessage('Your leave request has been submitted and is pending approval from operations.');
      setLeaveFromDate('');
      setLeaveToDate('');
      setLeaveReason('');
    } catch (err) {
      setModalConfig({
        isOpen: true,
        title: 'Leave Request Failed',
        message: err.response?.data?.error || 'Failed to submit leave request.',
        type: 'danger'
      });
    }
  };

  const handleInvoiceFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setInvoiceFile(file);
  };

  const handleSubmitInvoice = async () => {
    if (!invoiceTitle.trim()) {
      alert('Invoice title is required');
      return;
    }
    if (!invoiceFile) {
      alert('Please attach an invoice file');
      return;
    }

    setInvoiceSubmitting(true);
    try {
      const uploadRes = await uploadFiles('financeDocUploader', {
        files: [invoiceFile],
        headers: {
          authorization: `Bearer ${localStorage.getItem('coreknot_token')}`
        },
      });

      const uploaded = uploadRes?.[0];
      if (!uploaded?.url) throw new Error('File upload failed');

      await axios.post('/api/finance/submit-invoice', {
        title: invoiceTitle.trim(),
        amount: invoiceAmount,
        description: invoiceDescription.trim(),
        fileUrl: uploaded.url,
        fileKey: uploaded.key,
        fileName: uploaded.name || invoiceFile.name,
        fileSize: uploaded.size || invoiceFile.size,
        fileType: invoiceFile.type,
      });

      setInvoiceTitle('');
      setInvoiceAmount('');
      setInvoiceDescription('');
      setInvoiceFile(null);
      if (invoiceFileRef.current) invoiceFileRef.current.value = '';

      setModalConfig({
        isOpen: true,
        title: 'Invoice Submitted',
        message: 'Your invoice has been submitted and is pending approval from operations.',
        type: 'success'
      });
    } catch (err) {
      setModalConfig({
        isOpen: true,
        title: 'Invoice Submission Failed',
        message: err.response?.data?.message || err.message || 'Failed to submit invoice.',
        type: 'danger'
      });
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Account Settings"
        subtitle="Manage your personal profile and preferences."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
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
                       {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-full h-full p-4 opacity-20" />}
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
                 <Input type="date" label="Date of Birth" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} icon={CalendarDays} className="!text-xs" />
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
                           className="cursor-pointer hover:scale-105 transition-transform select-none"
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

          <Card className="overflow-hidden">
            <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Users size={14} className="text-teal-500" /> Department
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm">
                Current: <strong>{user?.departmentId?.name || 'Unassigned'}</strong>
              </p>
              {deptRequests.find((r) => r.status === 'pending') && (
                <p className="text-xs text-amber-600">Department change pending admin approval.</p>
              )}
              <div className="flex flex-wrap gap-2 items-end">
                <select
                  value={requestedDeptId}
                  onChange={(e) => setRequestedDeptId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] text-sm"
                >
                  <option value="">Request new department</option>
                  {departments.filter((d) => d.signupAllowed !== false).map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!requestedDeptId || submitDeptChange.isPending}
                  onClick={() => submitDeptChange.mutate(requestedDeptId, { onSuccess: () => setRequestedDeptId('') })}
                >
                  Request Change
                </Button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <CalendarDays size={14} className="text-violet-500" /> Apply for Leave
              </h3>
              {pendingLeaveCount > 0 && (
                <Badge variant="warning">{pendingLeaveCount} pending</Badge>
              )}
            </div>
            <div className="p-4 space-y-4">
              {(leaveSuccessMessage || pendingLeaveCount > 0) && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                  {leaveSuccessMessage || 'You have leave request(s) pending approval from operations.'}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input type="date" label="Leave From" value={leaveFromDate} onChange={(e) => setLeaveFromDate(e.target.value)} />
                <Input type="date" label="Leave To" value={leaveToDate} onChange={(e) => setLeaveToDate(e.target.value)} />
                <Input label="Reason" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
              </div>
              <Button
                size="sm"
                onClick={handleApplyLeave}
                disabled={!leaveFromDate || !leaveToDate || applyLeave.isPending}
              >
                {applyLeave.isPending ? 'Submitting...' : 'Submit Leave Request'}
              </Button>
              {(leaveFromDate || leaveToDate || leaveReason) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setLeaveFromDate('');
                    setLeaveToDate('');
                    setLeaveReason('');
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Receipt size={14} className="text-blue-500" /> Raise Invoice
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Title" value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} icon={FileText} />
                <Input label="Amount (INR)" type="text" inputMode="decimal" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
              </div>
              <Input label="Description" value={invoiceDescription} onChange={(e) => setInvoiceDescription(e.target.value)} />
              <div>
                <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-2 block">Invoice File</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={invoiceFileRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    onChange={handleInvoiceFileSelect}
                    className="text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[var(--color-bg-secondary)] file:text-[var(--color-text-primary)]"
                  />
                  {invoiceFile && (
                    <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[200px]">{invoiceFile.name}</span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSubmitInvoice}
                disabled={invoiceSubmitting || !invoiceTitle.trim() || !invoiceFile}
              >
                <Upload size={14} />
                {invoiceSubmitting ? 'Submitting...' : 'Submit Invoice'}
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} className="text-emerald-500" /> My Attendance
              </h3>
            </div>
            <div className="p-4">
              <div className="max-h-64 overflow-y-auto border border-[var(--color-bg-border)] rounded-xl">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--color-bg-secondary)] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Time In</th>
                      <th className="px-3 py-2 text-left">Time Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAttendance.map((row) => (
                      <tr key={row._id} className={`border-t border-[var(--color-bg-border)] ${getAttendanceRowClass(row)}`}>
                        <td className="px-3 py-2">{row.date ? new Date(row.date).toISOString().slice(0, 10) : '-'}</td>
                        <td className="px-3 py-2">{row.timeIn || '-'}</td>
                        <td className="px-3 py-2">{row.timeOut || '-'}</td>
                      </tr>
                    ))}
                    {myAttendance.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2">No attendance records yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-4 space-y-6">
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
                  animate={{ width: `${Math.min(100, Math.max(0, ((user?.exp || 0) - (Math.floor(100 * Math.pow((user?.level || 1) - 1, 1.5)))) / ((Math.floor(100 * Math.pow(user?.level || 1, 1.5))) - (Math.floor(100 * Math.pow((user?.level || 1) - 1, 1.5)))) * 100))}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                />
              </div>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-3 text-center uppercase tracking-widest">
                {user?.exp || 0} / {Math.floor(100 * Math.pow(user?.level || 1, 1.5))} XP
              </p>
            </div>
          </Card>

          <Card className="p-4 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
               <Palette size={14} /> Global Preferences
            </h4>
            <div className="space-y-2">
               <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                  <div className="flex items-center gap-3">
                     {theme === 'dark' ? <Moon size={16} className="text-blue-500" /> : <Sun size={16} className="text-amber-500" />}
                     <span className="text-[11px] font-black uppercase tracking-wider">Dark Mode</span>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className={`w-12 h-6 rounded-full transition-all duration-300 border-2 flex items-center shrink-0 ${theme === 'dark' ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-400/20 border-slate-400'}`}
                  >
                     <motion.div 
                       layout 
                       transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                       className={`w-5 h-5 rounded-full shadow-lg transition-all ${theme === 'dark' ? 'bg-blue-500 ml-6' : 'bg-white ml-0.5'}`} 
                     />
                  </button>
               </div>
               <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
                  <div className="flex flex-col gap-1 min-w-0">
                     <div className="flex items-center gap-3">
                        <Bell size={16} className="text-emerald-500" />
                        <span className="text-[11px] font-black uppercase tracking-wider">Desktop Notifications</span>
                     </div>
                     {pushPermission === 'denied' && (
                        <p className="text-[9px] text-rose-500 pl-7">Blocked in browser — enable notifications in site settings.</p>
                     )}
                  </div>
                  <button
                    type="button"
                    onClick={handlePushToggle}
                    disabled={pushLoading || pushPermission === 'denied'}
                    className={`w-12 h-6 rounded-full transition-all duration-300 border-2 flex items-center shrink-0 disabled:opacity-50 ${
                      pushEnabled ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-400/20 border-slate-400'
                    }`}
                  >
                     <motion.div
                       layout
                       transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                       className={`w-5 h-5 rounded-full shadow-lg transition-all ${
                         pushEnabled ? 'bg-emerald-500 ml-6' : 'bg-white ml-0.5'
                       }`}
                     />
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
               <p className="text-[9px] text-[var(--color-text-muted)]">Min 8 characters with at least one letter and one number.</p>
            </div>
            <div className="border-t border-[var(--color-bg-border)] pt-4 mt-4">
               <Button 
                 variant="danger" 
                 size="sm" 
                 onClick={() => {
                   if (window.confirm('Are you sure you want to sign out?')) {
                     localStorage.clear();
                     window.location.href = '/login';
                   }
                 }}
               >
                 Sign Out
               </Button>
            </div>
          </Card>
        </aside>
      </div>

      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-[100] border-t border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
               <div>
                  <p className="text-[11px] font-black text-[var(--color-text-primary)] uppercase tracking-widest">Unsaved Changes</p>
                  <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase mt-0.5">You have uncommitted edits to your profile</p>
               </div>
               <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setName(user?.name || '');
                      setAvatar(user?.avatar || '');
                      setPhone(user?.phone || '+91 ');
                      setDateOfBirth(formatDateInput(user?.dateOfBirth));
                      setTeams(user?.teams ? user.teams.map(t => ({ value: t, label: t })) : []);
                      setPassword('');
                      setNewPassword('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleUpdateProfile} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ModalShell isOpen={isAvatarModalOpen} onClose={() => setIsAvatarModalOpen(false)} size="xl" zIndex={200}>
        <header className="p-6 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)] shrink-0">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
            <Sparkles size={18} className="text-blue-500" /> Choose an Avatar
          </h3>
          <Button variant="ghost" size="xs" onClick={() => setIsAvatarModalOpen(false)}><X size={18} /></Button>
        </header>
        <div className="flex-1 overflow-hidden flex min-h-0">
          <aside className="w-48 bg-[var(--color-bg-secondary)] border-r border-[var(--color-bg-border)] p-4 space-y-1 shrink-0">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
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
                type="button"
                onClick={() => { setAvatar(url); setIsAvatarModalOpen(false); }}
                className={`aspect-square rounded-xl border-2 overflow-hidden transition-all hover:scale-105 ${avatar === url ? 'border-[var(--color-action-primary)]' : 'border-[var(--color-bg-border)] opacity-60 hover:opacity-100'}`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </main>
        </div>
      </ModalShell>

      <NexusModal isOpen={modalConfig.isOpen} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} title={modalConfig.title} message={modalConfig.message} type={modalConfig.type} />
    </PageContainer>
  );
};

export default SettingsPage;
