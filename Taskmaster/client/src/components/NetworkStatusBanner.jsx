import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md"
    >
      <WifiOff size={14} aria-hidden />
      Connection lost — changes may not save until you&apos;re back online
    </div>
  );
}
