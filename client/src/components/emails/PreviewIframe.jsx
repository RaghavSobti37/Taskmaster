import React, { useEffect, useRef } from 'react';

export default function PreviewIframe({ html, title = 'Email preview', className = '', minHeight = 480 }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const resize = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          const h = Math.max(doc.body.scrollHeight, minHeight);
          iframe.style.height = `${h}px`;
        }
      } catch {
        /* cross-origin guard */
      }
    };
    iframe.addEventListener('load', resize);
    return () => iframe.removeEventListener('load', resize);
  }, [html, minHeight]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      srcDoc={html || '<p style="padding:24px;font-family:sans-serif;color:#94a3b8">No preview available</p>'}
      title={title}
      className={`w-full rounded-xl border border-[var(--color-bg-border)] bg-white ${className}`}
      style={{ minHeight }}
    />
  );
}
