import React from 'react';
import MailProfilesPanel from '../../components/admin/MailProfilesPanel';
import { useMailProfiles } from '../../hooks/useTaskmasterQueries';

export default function EmailsProfilesPage() {
  const { data: profiles = [] } = useMailProfiles();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Sender Profiles</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Gmail profiles for personal sends. Bulk campaigns use Resend (API key on server).
        </p>
      </div>
      <MailProfilesPanel profiles={profiles} />
    </div>
  );
}
