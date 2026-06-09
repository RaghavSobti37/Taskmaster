import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input } from '../ui';
import { useResendFromEmailOptions } from '../../hooks/useResendFromEmailOptions';
import {
  VERIFIED_RESEND_DOMAIN,
  displayNameForResendEmail,
  isVerifiedResendEmail,
} from '../../constants/resendFromEmails';
import { useToast } from '../../contexts/ToastContext';

export default function ResendFromEmailPicker({ value, onChange }) {
  const toast = useToast();
  const { options, addEmail } = useResendFromEmailOptions();
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const handleAdd = () => {
    const result = addEmail(newEmail);
    if (!result.ok) {
      toast.warn(result.error);
      return;
    }
    onChange(result.email);
    setNewEmail('');
    setShowAdd(false);
    toast.success(`Added ${result.email}`);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
        From address (@{VERIFIED_RESEND_DOMAIN})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((email) => {
          const selected = value === email;
          return (
            <button
              key={email}
              type="button"
              onClick={() => onChange(email)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selected
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-[var(--color-bg-border)] hover:border-violet-500/40'
              }`}
            >
              <p className="font-semibold text-sm">{displayNameForResendEmail(email)}</p>
              <p className="text-xs text-[var(--color-text-muted)] font-mono">{email}</p>
            </button>
          );
        })}
      </div>

      {showAdd ? (
        <div className="p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] space-y-2">
          <Input
            label="New verified email"
            placeholder={`name@${VERIFIED_RESEND_DOMAIN}`}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="xs" variant="ghost" onClick={() => { setShowAdd(false); setNewEmail(''); }}>Cancel</Button>
            <Button
              size="xs"
              onClick={handleAdd}
              disabled={!isVerifiedResendEmail(newEmail)}
            >
              Add address
            </Button>
          </div>
        </div>
      ) : (
        <Button size="xs" variant="secondary" onClick={() => setShowAdd(true)}>
          <Plus size={12} /> Add verified @{VERIFIED_RESEND_DOMAIN} email
        </Button>
      )}
    </div>
  );
}
