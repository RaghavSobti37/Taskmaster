import React from 'react';
import { Card } from '../../../../components/ui';
import ProfileTab from '../../../settings/tabs/ProfileTab';

export default function ArtistWorkspaceSettings() {
  return (
    <Card className="p-4 sm:p-6 rounded-2xl border border-[var(--color-bg-border)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
        Your profile
      </p>
      <ProfileTab />
    </Card>
  );
}
