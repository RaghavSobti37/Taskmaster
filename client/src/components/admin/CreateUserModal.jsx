import React, { useState } from 'react';
import { UserPlus, Copy, Check, RefreshCw } from 'lucide-react';
import { Button, Input } from '../ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';;
import { formatUserCredentialsForCopy } from '../../utils/passwordValidation';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  departmentId: '',
  gender: 'male',
};

const CreateUserModal = ({ isOpen, onClose, departments = [], onCreate, isPending }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setForm(EMPTY_FORM);
    setCredentials(null);
    setCopied(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const result = await onCreate({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        dateOfBirth: form.dateOfBirth || null,
        departmentId: form.departmentId || null,
        gender: form.gender,
      });
      setCredentials(result.credentials);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create user');
    }
  };

  const handleCopyCredentials = async () => {
    if (!credentials) return;
    const text = formatUserCredentialsForCopy(credentials.email, credentials.temporaryPassword);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} size="md" zIndex={1100}>
      <ModalHeader
        title={credentials ? 'User created' : 'Add user'}
        subtitle={credentials ? 'Share these credentials securely — shown once.' : 'Create a CoreKnot account with a temporary password.'}
        icon={UserPlus}
        onClose={handleClose}
      />

      {credentials ? (
        <>
          <ModalBody className="space-y-4">
            <div className="py-4 border-b border-emerald-500/25 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Email</p>
                <p className="text-sm font-mono font-bold break-all">{credentials.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Temporary password</p>
                <p className="text-sm font-mono font-bold break-all select-all">{credentials.temporaryPassword}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              User must set a new password on first login. Password requirements are shown at that step.
            </p>
          </ModalBody>
          <ModalFooter className="gap-2">
            <Button variant="ghost" onClick={handleClose}>Done</Button>
            <Button onClick={handleCopyCredentials} className="gap-2">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy email & password'}
            </Button>
          </ModalFooter>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <Input
              label="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Email address"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 …"
            />
            <Input
              type="date"
              label="Date of birth (optional)"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Department</label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none"
              >
                <option value="">Unassigned</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Gender (avatar)</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              A strong random temporary password is generated automatically. Copy it after creation to share with the user.
            </p>
          </ModalBody>
          <ModalFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.name.trim() || !form.email.trim()} className="gap-2">
              {isPending ? <RefreshCw size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Create user
            </Button>
          </ModalFooter>
        </form>
      )}
    </ModalShell>
  );
};

export default CreateUserModal;
