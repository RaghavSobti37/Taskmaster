import React from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../ui';

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export function getTenantMembershipFromUser(user) {
  if (!user) return null;
  const membership = user.tenantMembership;
  if (!membership && user.tenantMembershipRole == null && user.needsRoleReview == null) {
    return null;
  }
  return {
    role: user.tenantMembershipRole ?? membership?.role,
    customRoleName:
      user.tenantCustomRoleName
      ?? membership?.customRole?.name
      ?? membership?.customRoleName,
    needsRoleReview: Boolean(user.needsRoleReview ?? membership?.needsRoleReview),
  };
}

export default function TenantMemberRoleBadge({
  role,
  customRoleName,
  needsRoleReview = false,
  className = '',
  linkTo = '/admin/users',
}) {
  const resolvedRole = role ? String(role).toLowerCase() : '';
  const hasAssignedRole = Boolean(customRoleName || ROLE_LABELS[resolvedRole]);
  const showReview = needsRoleReview || !hasAssignedRole;

  if (showReview) {
    return (
      <Link to={linkTo} className={`inline-flex ${className}`} title="Assign organization role">
        <StatusBadge role="advisory" className="!text-[9px] uppercase font-mono shrink-0">
          Needs role review
        </StatusBadge>
      </Link>
    );
  }

  const label = customRoleName || ROLE_LABELS[resolvedRole] || resolvedRole;
  return (
    <StatusBadge role="neutral" className={`!text-[9px] uppercase font-mono shrink-0 ${className}`}>
      {label}
    </StatusBadge>
  );
}
