import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, Loader2 } from 'lucide-react';
import {
  financeFilePreviewUrl,
  isFinanceImage,
  isFinancePdf,
} from '../../utils/financeFilePreview';

/**
 * Fetches finance files with auth cookies and shows inline via blob URL
 * (avoids iframe→API download / X-Frame-Options / wrong MIME issues).
 */
export default function FinanceDocumentPreview({
  doc,
  previewPath: previewPathOverride,
  className = '',
  imgClassName = '',
  iframeClassName = '',
  emptyClassName = '',
}) {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const previewPath = previewPathOverride || financeFilePreviewUrl(doc);
  const isPdf = isFinancePdf(doc);
  const isImage = isFinanceImage(doc);

  useEffect(() => {
    if (!previewPath || (!isPdf && !isImage)) {
      setBlobUrl('');
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = '';

    setLoading(true);
    setError('');
    setBlobUrl('');

    axios
      .get(previewPath, { responseType: 'blob', withCredentials: true })
      .then((res) => {
        if (cancelled) return;
        let blob = res.data;
        if (isPdf && blob?.type !== 'application/pdf') {
          blob = new Blob([blob], { type: 'application/pdf' });
        }
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || err.message || 'Preview failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewPath, isPdf, isImage]);

  if (!previewPath) {
    return (
      <div className={`flex items-center justify-center text-[var(--color-text-muted)] text-xs ${emptyClassName || className}`}>
        No preview available
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 text-[var(--color-text-muted)] text-xs ${className}`}>
        <Loader2 size={16} className="animate-spin" />
        Loading preview…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 text-center p-4 text-xs text-rose-400 ${className}`}>
        <FileText size={24} className="opacity-60" />
        <p>{error}</p>
      </div>
    );
  }

  if (isPdf && blobUrl) {
    return (
      <iframe
        src={blobUrl}
        title={doc?.title || doc?.fileName || 'Document preview'}
        className={iframeClassName || className}
      />
    );
  }

  if (isImage && blobUrl) {
    return (
      <img
        src={blobUrl}
        alt={doc?.title || doc?.fileName || 'Document'}
        className={imgClassName || className}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center text-[var(--color-text-muted)] text-xs ${emptyClassName || className}`}>
      Preview not supported
    </div>
  );
}
