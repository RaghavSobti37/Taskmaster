import React from 'react';
import { resolveStatusRole } from './statusRole.js';

export { resolveStatusRole } from './statusRole.js';

const ROLE_CLASS = {
  neutral: 'badge-slate',
  positive: 'badge-teal',
  active: 'badge-blue',
  advisory: 'badge-apricot',
  error: 'badge-rose',
};

/**
 * StatusBadge — canonical status colors (teal positive, blue/amber active, gray neutral, red error).
 */
export default function StatusBadge({
  status,
  children,
  className = '',
  role: roleProp,
}) {
  const label = children ?? status;
  const role = roleProp || resolveStatusRole(status ?? label);

  return (
    <span className={`badge-pastel ${ROLE_CLASS[role] || ROLE_CLASS.neutral} ${className}`}>
      {label}
    </span>
  );
}
