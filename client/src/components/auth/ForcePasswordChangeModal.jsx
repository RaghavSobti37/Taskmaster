import React, { useState } from 'react';
import axios from 'axios';
import { Shield, KeyRound, Eye, EyeOff } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, Button, Input } from '../ui';
import PasswordRequirements from './PasswordRequirements';
import { validatePasswordStrength } from '../../utils/passwordValidation';
import { useAuth } from '../../contexts/AuthContext';

const ForcePasswordChangeModal = () => {
  const { user, login } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user?.mustChangePassword) return null;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const validationError = validatePasswordStrength(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/change-required-password', {
        newPassword,
        confirmPassword,
      });
      login(data);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen size="md" zIndex={2000} closeOnBackdrop={false} closeOnEscape={false}>
      <ModalHeader title="Set your new password" icon={Shield} showClose={false} />
      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Welcome{user.name ? `, ${user.name.split(' ')[0]}` : ''}. Your account uses a temporary password.
            Choose a new password before continuing.
          </p>

          <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
              <KeyRound size={12} /> Password requirements
            </p>
            <PasswordRequirements password={newPassword} />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          )}

          <Input
            type={showNewPassword ? 'text' : 'password'}
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            endAdornment={passwordToggle(showNewPassword, setShowNewPassword)}
          />
          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            endAdornment={passwordToggle(showConfirmPassword, setShowConfirmPassword)}
          />
        </ModalBody>
        <ModalFooter>
          <Button type="submit" disabled={loading || !newPassword || !confirmPassword} className="w-full">
            {loading ? 'Saving…' : 'Save new password'}
          </Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};

export default ForcePasswordChangeModal;
