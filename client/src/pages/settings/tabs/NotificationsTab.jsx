import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Smartphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../components/ui';
import InstallGuideModal from '../../../components/auth/InstallGuideModal';
import {
  canUseWebPush,
  enablePushNotifications,
  getNotificationPushStatus,
  getPushUnsupportedReason,
  isIosDevice,
  isPushPreferenceEnabled,
  unsubscribeFromPush,
} from '../../../utils/notifications';
import { isStandaloneDisplay } from '../../../utils/displayMode';

export default function NotificationsTab() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [installOpen, setInstallOpen] = useState(false);

  const refresh = useCallback(async () => {
    const next = await getNotificationPushStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEnable = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (!canUseWebPush()) {
        setMessage(getPushUnsupportedReason() || 'Push is not available on this device');
        return;
      }
      const ok = await enablePushNotifications();
      const next = await refresh();
      if (ok && next.enabled) {
        setMessage('Push notifications enabled for this device.');
      } else if (next.permission === 'denied') {
        setMessage('Notifications are blocked in browser settings. Allow CoreKnot in your browser, then try again.');
      } else {
        setMessage('Could not enable push. Check that VAPID keys are configured on the server.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setMessage('');
    try {
      await unsubscribeFromPush();
      await refresh();
      setMessage('Push notifications disabled on this device.');
    } finally {
      setBusy(false);
    }
  };

  const permissionLabel = {
    granted: 'Allowed',
    denied: 'Blocked',
    default: 'Not asked yet',
    unsupported: 'Unsupported',
  }[status?.permission] || status?.permission;

  const showIosInstall = isIosDevice() && !isStandaloneDisplay();

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="border-b border-[var(--color-bg-border)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Notifications</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Get inbox, task, and mention alerts when CoreKnot is closed or in the background.
        </p>
      </div>

      {showIosInstall && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex gap-3">
          <Smartphone size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text-primary)] font-semibold">Install CoreKnot first (iOS)</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              iPhone and iPad only receive push alerts from the installed home-screen app, not Safari tabs.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={() => setInstallOpen(true)}>
              How to install
            </Button>
          </div>
        </div>
      )}

      {status?.blocker && !showIosInstall && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-text-secondary)]">{status.blocker}</p>
        </div>
      )}

      <section className="rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-5 space-y-4">
        <h3 className="tm-widget-label flex items-center gap-2">
          <Bell size={14} className="text-[var(--color-brand-teal)]" />
          Push on this device
        </h3>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-bold">Browser permission</dt>
            <dd className="text-[var(--color-text-primary)] font-medium mt-0.5">{permissionLabel}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-bold">Push subscription</dt>
            <dd className="text-[var(--color-text-primary)] font-medium mt-0.5 flex items-center gap-1.5">
              {status?.subscribed ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Active
                </>
              ) : (
                <>
                  <BellOff size={14} className="text-[var(--color-text-muted)]" />
                  Not subscribed
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-bold">Preference</dt>
            <dd className="text-[var(--color-text-primary)] font-medium mt-0.5">
              {isPushPreferenceEnabled() ? 'Enabled' : 'Disabled'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-bold">Delivery</dt>
            <dd className="text-[var(--color-text-primary)] font-medium mt-0.5">
              {status?.enabled ? 'Web Push (background)' : 'In-app only'}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="primary"
            disabled={busy || status?.enabled}
            onClick={handleEnable}
          >
            <BellRing size={16} />
            {busy ? 'Working…' : 'Enable push'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !status?.subscribed}
            onClick={handleDisable}
          >
            <BellOff size={16} />
            Disable on this device
          </Button>
        </div>

        {message && (
          <p className="text-sm text-[var(--color-text-secondary)] border-t border-[var(--color-bg-border)] pt-3">
            {message}
          </p>
        )}
      </section>

      <section className="text-sm text-[var(--color-text-muted)] space-y-2">
        <p>Works on Chrome, Edge, Firefox, and Safari (desktop and Android). Each device/browser needs its own enable.</p>
        <p>With push on, the service worker shows one OS alert per event — no duplicate toasts while the app is open.</p>
      </section>

      <InstallGuideModal isOpen={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
