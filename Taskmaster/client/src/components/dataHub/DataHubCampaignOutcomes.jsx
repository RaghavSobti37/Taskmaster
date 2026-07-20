import { ExternalLink, MessageSquare } from 'lucide-react';
import { Button } from '../ui';
import { buildAutoMailerUrl } from '../../utils/autoMailerUrl';

export default function DataHubCampaignOutcomes({ open, onClose }) {
  if (!open) return null;
  const url = buildAutoMailerUrl('/data-hub');

  return (
    <div className="mb-4 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <MessageSquare size={18} className="mt-0.5 text-[var(--color-text-muted)]" />
          <div>
            <p className="text-sm font-semibold">Campaign outcomes moved</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              WhatsApp and email-adjacent campaign outcomes now live in Auto Mailer.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="!px-2" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button variant="primary" size="sm" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
          <ExternalLink size={14} /> Open Auto Mailer
        </Button>
        <p className="text-xs text-[var(--color-text-muted)] break-all">{url}</p>
      </div>
    </div>
  );
}
