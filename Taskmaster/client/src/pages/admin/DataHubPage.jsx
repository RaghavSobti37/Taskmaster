import { ExternalLink, Server, Upload, Users } from 'lucide-react';
import { Button } from '../../components/ui/primitives';
import { buildAutoMailerUrl } from '../../utils/autoMailerUrl';

export function DataHubContent() {
  const autoMailerUrl = buildAutoMailerUrl('/data-hub');

  const openAutoMailer = () => {
    window.open(autoMailerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 py-8">
      <section className="w-full max-w-3xl rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-brand-teal)_16%,transparent)] text-[var(--color-brand-teal)]">
            <Users size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Data Hub moved</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Open Auto Mailer Audience Hub</h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Audience folders, campaign outcomes, AiSensy imports, CSV ingestion, and email-adjacent Data Hub workflows now live in Auto Mailer.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: Users, label: 'Audience folders' },
            { icon: Upload, label: 'AiSensy imports' },
            { icon: Server, label: 'Docker Data Hub' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-3">
              <Icon size={16} className="text-[var(--color-text-muted)]" />
              <p className="mt-2 text-xs font-semibold">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="primary" onClick={openAutoMailer}>
            <ExternalLink size={16} /> Open Auto Mailer
          </Button>
          <p className="text-xs text-[var(--color-text-muted)] break-all">{autoMailerUrl}</p>
        </div>
      </section>
    </div>
  );
}

export default function DataHubPage() {
  return <DataHubContent />;
}
