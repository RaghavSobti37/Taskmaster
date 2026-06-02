import React from 'react';
import { Check, X } from 'lucide-react';
import { getPasswordRequirementChecks } from '../../utils/passwordValidation';

const PasswordRequirements = ({ password = '', className = '' }) => {
  const checks = getPasswordRequirementChecks(password);

  return (
    <ul className={`space-y-1.5 ${className}`}>
      {checks.map(({ id, label, met }) => (
        <li key={id} className="flex items-start gap-2 text-[11px]">
          {met ? (
            <Check size={14} className="shrink-0 mt-0.5 text-emerald-500" aria-hidden />
          ) : (
            <X size={14} className="shrink-0 mt-0.5 text-red-500" aria-hidden />
          )}
          <span className={met ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}>
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default PasswordRequirements;
