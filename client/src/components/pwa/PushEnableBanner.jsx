import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { enablePushNotifications } from '../../utils/notifications';

const DISMISS_KEY = 'coreknot-push-prompt-dismissed';
const MIN_SESSIONS = 3;

/** Prompt Web Push after repeat sessions (#36). */
export default function PushEnableBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      const sessions = Number(localStorage.getItem('coreknot-session-count') || 0) + 1;
      localStorage.setItem('coreknot-session-count', String(sessions));
      if (sessions >= MIN_SESSIONS) setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[85] max-w-sm rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-3 shadow-lg">
      <div className="flex items-start gap-2">
        <Bell size={16} className="mt-0.5 text-[var(--color-action-primary)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wide">Enable alerts</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">Task assignments and mentions on this device.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-[var(--color-action-primary)] px-2 py-1 text-[10px] font-black uppercase text-white"
              onClick={async () => {
                await enablePushNotifications();
                dismiss();
              }}
            >
              Enable
            </button>
            <button type="button" className="text-[10px] text-[var(--color-text-muted)]" onClick={dismiss}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
