import { ExternalLink, Upload } from 'lucide-react';
import { Button } from '../ui';
import { buildAutoMailerUrl } from '../../utils/autoMailerUrl';

export default function DataHubCampaignImport({ compact = false, className = '' }) {
  const url = buildAutoMailerUrl('/data-hub');
  const openAutoMailer = () => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <Button
      variant="secondary"
      size="sm"
      className={`!px-2.5 whitespace-nowrap w-full justify-start ${className}`.trim()}
      onClick={openAutoMailer}
      title="AiSensy and campaign imports moved to Auto Mailer"
    >
      {compact ? <Upload size={14} /> : <ExternalLink size={14} />}
      {compact ? 'Auto Mailer import' : 'Open Auto Mailer Import'}
    </Button>
  );
}
