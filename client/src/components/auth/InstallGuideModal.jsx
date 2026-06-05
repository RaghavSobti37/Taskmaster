import React, { useMemo } from 'react';
import { Smartphone, Download, CheckCircle2 } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/ModalShell';
import { Button } from '../ui';
import { detectInstallPlatform, getInstallGuideSteps } from '../../utils/installPlatform';

export default function InstallGuideModal({ isOpen, onClose }) {
  const platformInfo = useMemo(() => detectInstallPlatform(), [isOpen]);
  const guide = useMemo(() => getInstallGuideSteps(platformInfo), [platformInfo]);

  const Icon = platformInfo.installed ? CheckCircle2 : platformInfo.platform.includes('ios') || platformInfo.platform.includes('android')
    ? Smartphone
    : Download;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} size="md" ariaLabel={guide.title}>
      <ModalHeader
        title={guide.title}
        subtitle={guide.subtitle}
        icon={Icon}
        iconStyle={{ backgroundColor: 'rgba(18, 109, 94, 0.12)', color: '#126d5e' }}
        onClose={onClose}
      />
      <ModalBody>
        <div className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] px-4 py-3 mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
            Detected device
          </p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{platformInfo.label}</p>
        </div>

        <ol className="space-y-3">
          {guide.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-teal)]/15 text-[11px] font-black text-[var(--color-brand-teal)]">
                {index + 1}
              </span>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pt-0.5">{step.text}</p>
            </li>
          ))}
        </ol>

        {!platformInfo.installed && (
          <p className="mt-5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            After installing, sign in with your TSC account. Your session and notifications work the same as in the browser.
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="primary" onClick={onClose}>
          Got it
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}
