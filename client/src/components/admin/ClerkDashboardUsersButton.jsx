import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui';
import { openClerkDashboard } from '../../config/clerk';

/** Opens Clerk Dashboard → Users (production instance when selected in Clerk). */
export default function ClerkDashboardUsersButton({ size = 'sm', className = '' }) {
  return (
    <Button
      variant="secondary"
      size={size}
      className={`gap-2 ${className}`.trim()}
      title="Open Clerk user directory in Clerk Dashboard"
      onClick={() => openClerkDashboard('users')}
    >
      <ExternalLink size={14} aria-hidden />
      Manage in Clerk
    </Button>
  );
}
