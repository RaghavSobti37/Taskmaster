import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui';
import MailTemplateStudio from '../../components/admin/MailTemplateStudio';

export default function EmailsTemplatesPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Template Studio</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Build email templates, submit for approval, then use them in campaigns
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--color-text-muted)]">New to templates?</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          onClick={() => navigate('/emails/create')}
        >
          Go to Create Campaign <ArrowRight size={12} />
        </Button>
      </div>
      <MailTemplateStudio
        onUseInCampaign={(t) => {
          navigate(`/emails/create?templateId=${t._id}${t.subject ? `&subject=${encodeURIComponent(t.subject)}` : ''}`);
        }}
      />
    </div>
  );
}
