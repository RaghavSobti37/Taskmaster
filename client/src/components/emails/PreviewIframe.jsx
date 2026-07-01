import React, { useEffect, useRef, useCallback } from 'react';
import { PREVIEW_BODY_PADDING } from '../../utils/emailBlockSpacing';

const PREVIEW_OVERFLOW_CSS = `
  html, body { box-sizing: border-box !important; overflow-wrap: break-word !important; word-break: break-word !important; }
  body { padding: ${PREVIEW_BODY_PADDING} !important; margin: 0 !important; overflow: hidden !important; }
  body *, body a, body p, body li, body td { max-width: 100% !important; overflow-wrap: break-word !important; word-break: break-word !important; }
  table { max-width: 100% !important; table-layout: fixed !important; }
`;

function applyPreviewDocStyles(doc) {
  if (!doc?.body) return;
  doc.documentElement.style.overflow = 'hidden';
  doc.documentElement.style.boxSizing = 'border-box';
  doc.body.style.overflow = 'hidden';
  doc.body.style.margin = '0';
  doc.body.style.padding = PREVIEW_BODY_PADDING;
  doc.body.style.boxSizing = 'border-box';
  doc.body.style.overflowWrap = 'break-word';
  doc.body.style.wordBreak = 'break-word';

  let style = doc.getElementById('preview-overflow-fix');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'preview-overflow-fix';
    (doc.head || doc.documentElement).appendChild(style);
  }
  style.textContent = PREVIEW_OVERFLOW_CSS;
}

export default function PreviewIframe({ html, title = 'Email preview', className = '', minHeight = 480 }) {
  const iframeRef = useRef(null);

  const resize = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc?.body) return;
      applyPreviewDocStyles(doc);
      const h = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
        doc.body.offsetHeight,
        minHeight,
      );
      iframe.style.height = `${h}px`;
    } catch {
      /* cross-origin guard */
    }
  }, [minHeight]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    let resizeObserver;
    const onLoad = () => {
      resize();
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          resizeObserver = new ResizeObserver(() => resize());
          resizeObserver.observe(doc.body);
          doc.querySelectorAll('img').forEach((img) => {
            if (!img.complete) img.addEventListener('load', resize, { once: true });
          });
        }
      } catch {
        /* same-origin only */
      }
    };

    iframe.addEventListener('load', onLoad);
    const t1 = window.setTimeout(onLoad, 0);
    const t2 = window.setTimeout(onLoad, 200);
    const t3 = window.setTimeout(onLoad, 600);

    return () => {
      iframe.removeEventListener('load', onLoad);
      resizeObserver?.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [html, resize]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      scrolling="no"
      srcDoc={html || '<p style="padding:24px;font-family:sans-serif;color:#94a3b8">No preview available</p>'}
      title={title}
      className={`w-full max-w-full rounded-xl border border-[var(--color-bg-border)] bg-white block ${className}`}
      style={{ minHeight, overflow: 'hidden' }}
    />
  );
}
