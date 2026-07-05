import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  isStagingPreviewOnProdDb,
  STAGING_PROD_DB_BANNER_STORAGE_KEY,
} from '../utils/stagingPreview';

export default function StagingProdDbBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isStagingPreviewOnProdDb()) return;
    try {
      if (localStorage.getItem(STAGING_PROD_DB_BANNER_STORAGE_KEY) === '1') return;
    } catch {
      /* private mode */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STAGING_PROD_DB_BANNER_STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[210] flex items-center justify-center gap-3 bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md"
    >
      <span className="text-center">
        Warning: staging preview hits production MongoDB — test writes carefully.
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Dismiss staging warning"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
