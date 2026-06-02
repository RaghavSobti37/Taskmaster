import React from 'react';

const SIZE_CLASS = {
  xs: 'w-5 h-5 text-[8px]',
  sm: 'w-7 h-7 text-[9px]',
  md: 'w-9 h-9 text-[10px]',
  lg: 'w-11 h-11 text-xs',
  xl: 'w-14 h-14 text-sm',
};

const initialsFrom = (name) => {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
};

/**
 * Standard user avatar — image or initials fallback.
 * @param {object} [user] - { name, avatar }
 * @param {string} [name]
 * @param {string} [avatar]
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [size]
 */
export function UserAvatar({
  user,
  name: nameProp,
  avatar: avatarProp,
  size = 'sm',
  className = '',
  title,
}) {
  const displayName = nameProp ?? user?.name ?? '';
  const src = avatarProp ?? user?.avatar;
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.sm;
  const resolvedTitle = title != null && title !== '' ? title : displayName || undefined;

  if (src) {
    return (
      <img
        src={src}
        alt=""
        title={resolvedTitle}
        className={`rounded-full object-cover shrink-0 border border-[var(--color-bg-border)] ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <span
      title={resolvedTitle}
      className={`rounded-full shrink-0 flex items-center justify-center font-bold bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-secondary)] ${sizeClass} ${className}`}
    >
      {initialsFrom(displayName)}
    </span>
  );
}

/**
 * Avatar + name row for tables and lists.
 */
export function UserLabel({
  user,
  name: nameProp,
  avatar: avatarProp,
  size = 'sm',
  showName = true,
  nameClassName = 'font-bold text-xs text-[var(--color-text-primary)] truncate',
  className = '',
  subtitle,
}) {
  const displayName = nameProp ?? user?.name ?? '—';

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <UserAvatar user={user} name={displayName} avatar={avatarProp} size={size} />
      {showName && (
        <div className="min-w-0">
          <span className={nameClassName}>{displayName}</span>
          {subtitle && (
            <p className="text-[9px] text-[var(--color-text-muted)] truncate">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default UserAvatar;
