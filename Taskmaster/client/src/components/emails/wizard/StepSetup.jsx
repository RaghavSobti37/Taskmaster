import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Mail, Zap } from 'lucide-react';
import { Input } from '../../ui';
import { formatProfileResetTime } from '../../admin/MailProfilesPanel';
import ResendFromEmailPicker from '../ResendFromEmailPicker';
import { ROOT_DOMAIN } from '../../../constants/resendFromEmails';

export default function StepSetup({ profiles = [] }) {
  const { register, watch, setValue } = useFormContext();
  const senderMode = watch('senderMode');
  const senderProfileId = watch('senderProfileId');
  const resendFromEmail = watch('resendFromEmail');
  const emailStreamSlug = watch('emailStreamSlug');

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Campaign Name" placeholder="e.g. May Product Release" {...register('title')} />
        <Input label="Email Subject" placeholder="e.g. Unlocking Next-Gen Capabilities" {...register('subject')} />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)]">How do you want to send?</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">CoreKnot redirects campaign sending to Auto-Mailer. Legacy sender choices stay read-only here.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setValue('senderMode', 'system_resend', { shouldValidate: true })}
            className={`text-left p-4 rounded-xl border transition-all ${
              senderMode === 'system_resend'
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-[var(--color-bg-border)] hover:border-violet-500/40'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Mail size={16} className="text-violet-500" />
              <p className="font-semibold text-sm">Auto-Mailer</p>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Managed in Auto-Mailer. Pick a sending stream and from address on <strong>{ROOT_DOMAIN}</strong> there.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setValue('senderMode', 'single', { shouldValidate: true })}
            className={`text-left p-4 rounded-xl border transition-all ${
              senderMode === 'single'
                ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10'
                : 'border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/40'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-[var(--color-action-primary)]" />
              <p className="font-semibold text-sm">Gmail</p>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Managed in Auto-Mailer when campaign sending is needed.
            </p>
          </button>
        </div>
      </div>

      {senderMode === 'system_resend' && (
        <ResendFromEmailPicker
          value={resendFromEmail}
          onChange={(email) => setValue('resendFromEmail', email, { shouldValidate: true })}
          streamSlug={emailStreamSlug}
          onStreamChange={(slug) => setValue('emailStreamSlug', slug, { shouldValidate: true })}
        />
      )}

      {senderMode === 'single' && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Legacy Gmail Profile</p>
          {profiles.length === 0 ? (
            <p className="text-xs text-amber-500 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              No Gmail profiles here. Open Auto-Mailer for campaign sender setup.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profiles.map((p) => {
                const selected = senderProfileId === p._id;
                const pct = p.usage?.percent || 0;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => setValue('senderProfileId', p._id, { shouldValidate: true })}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selected
                        ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]/10'
                        : 'border-[var(--color-bg-border)] hover:border-[var(--color-action-primary)]/40'
                    }`}
                  >
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{p.email}</p>
                    {p.usage && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
                          <span>Today</span>
                          <span className={pct >= 80 ? 'text-amber-500 font-bold' : ''}>{p.usage.used}/{p.usage.limit}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 80 ? 'bg-amber-500' : 'bg-[var(--color-action-primary)]'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-[var(--color-text-muted)]">{formatProfileResetTime(p.usage.resetAt)}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
