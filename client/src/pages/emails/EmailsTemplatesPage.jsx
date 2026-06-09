import React from 'react';
import { useNavigate } from 'react-router-dom';
import MailTemplateStudio from '../../components/admin/MailTemplateStudio';

export default function EmailsTemplatesPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Template Studio</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Draft, submit, and approve email templates for campaigns
        </p>
      </div>
      <MailTemplateStudio
        onUseInCampaign={(t) => {
          navigate(`/emails/create?templateId=${t._id}${t.subject ? `&subject=${encodeURIComponent(t.subject)}` : ''}`);
        }}
      />
    </div>
  );
}
