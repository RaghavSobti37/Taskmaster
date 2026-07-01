import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './primitives';

/** Password field with show/hide toggle (44px touch target on mobile). */
export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);

  const toggle = (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      aria-label={visible ? 'Hide password' : 'Show password'}
    >
      {visible ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );

  return (
    <Input
      type={visible ? 'text' : 'password'}
      endAdornment={toggle}
      {...props}
    />
  );
}
