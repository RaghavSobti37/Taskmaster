import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Monitor, Smartphone, Maximize2, X, ArrowLeft, MoreVertical,
  Star, Archive, Trash2, Reply, Forward, ChevronLeft, Printer, ExternalLink,
} from 'lucide-react';
import PreviewIframe from './PreviewIframe';

const DEVICE = {
  desktop: { label: 'Desktop', icon: Monitor },
  mobile: { label: 'Mobile', icon: Smartphone },
};

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatMockTime() {
  return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function DesktopEmailMock({
  html, title, minHeight, subject, fromName, fromEmail, toLabel, className = '',
}) {
  const displaySubject = subject?.trim() || 'Email subject';
  const from = fromEmail?.trim() || 'artist@theshakticollective.in';
  const sender = fromName?.trim() || 'The Shakti Collective';
  const timeLabel = formatMockTime();

  return (
    <div
      className={`w-full max-w-[820px] overflow-hidden rounded-2xl shadow-xl ring-1 ring-[#dadce0]/80 ${className}`}
    >
      {/* Gmail-style reading pane — soft backdrop + white message sheet */}
      <div className="bg-gradient-to-br from-[#d3e3fd]/50 via-[#f2f6fc] to-[#e8f0fe] p-3 sm:p-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(60,64,67,0.15)] ring-1 ring-[#dadce0]/60">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 border-b border-[#e8eaed] px-1 py-1">
            <button type="button" className="rounded-full p-2.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-hidden tabIndex={-1}>
              <ArrowLeft size={18} />
            </button>
            <button type="button" className="rounded-full p-2.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-hidden tabIndex={-1}>
              <Archive size={17} />
            </button>
            <button type="button" className="rounded-full p-2.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-hidden tabIndex={-1}>
              <Trash2 size={17} />
            </button>
            <button type="button" className="rounded-full p-2.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-hidden tabIndex={-1}>
              <Star size={17} />
            </button>
            <div className="flex-1" />
            <button type="button" className="rounded-full p-2.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-hidden tabIndex={-1}>
              <Printer size={17} />
            </button>
            <button type="button" className="rounded-full p-2.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-hidden tabIndex={-1}>
              <ExternalLink size={17} />
            </button>
            <button type="button" className="rounded-full p-2.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-hidden tabIndex={-1}>
              <MoreVertical size={18} />
            </button>
          </div>

          {/* Subject + inbox label */}
          <div className="border-b border-[#e8eaed] px-5 pb-4 pt-5 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-[22px] font-normal leading-tight text-[#202124]">{displaySubject}</h2>
              <span className="rounded px-2 py-0.5 text-[11px] font-medium text-[#5f6368]">Inbox</span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-sm font-semibold text-white"
                  aria-hidden
                >
                  {initials(sender)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="text-sm font-medium text-[#202124]">{sender}</span>
                    <span className="text-xs text-[#5f6368]">&lt;{from}&gt;</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#5f6368]">
                    to {toLabel || 'me'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 text-[#5f6368]" aria-hidden>
                <span className="mr-1 hidden text-xs sm:inline">{timeLabel}</span>
                <button type="button" className="rounded-full p-2 hover:bg-[#f1f3f4]" tabIndex={-1}>
                  <Star size={17} />
                </button>
                <button type="button" className="rounded-full p-2 hover:bg-[#f1f3f4]" tabIndex={-1}>
                  <Reply size={17} />
                </button>
                <button type="button" className="rounded-full p-2 hover:bg-[#f1f3f4]" tabIndex={-1}>
                  <MoreVertical size={17} />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white">
            <PreviewIframe html={html} title={title} minHeight={minHeight} className="rounded-none border-0" />
          </div>

          {/* Reply / Forward */}
          <div className="flex flex-wrap gap-2 border-t border-[#e8eaed] px-5 py-4 sm:px-6">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] px-5 py-2 text-sm font-medium text-[#5f6368] hover:bg-[#f8f9fa]"
              aria-hidden
              tabIndex={-1}
            >
              <Reply size={16} />
              Reply
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] px-5 py-2 text-sm font-medium text-[#5f6368] hover:bg-[#f8f9fa]"
              aria-hidden
              tabIndex={-1}
            >
              <Forward size={16} />
              Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileEmailMock({
  html, title, minHeight, subject, fromName, fromEmail, toLabel, className = '',
}) {
  const displaySubject = subject?.trim() || 'Email subject';
  const from = fromEmail?.trim() || 'artist@theshakticollective.in';
  const sender = fromName?.trim() || 'The Shakti Collective';

  return (
    <div className={`w-[390px] max-w-full shrink-0 ${className}`}>
      <div className="rounded-[2.25rem] border-[11px] border-[#1c1c1e] bg-[#1c1c1e] shadow-2xl">
        {/* Dynamic island / notch */}
        <div className="h-7 bg-[#1c1c1e] flex items-end justify-center pb-0.5">
          <div className="w-[100px] h-[22px] rounded-full bg-black" aria-hidden />
        </div>

        {/* iOS status bar */}
        <div className="flex items-center justify-between px-6 py-1 bg-[#f2f2f7] text-[10px] font-semibold text-[#1c1c1e]">
          <span>{formatMockTime()}</span>
          <div className="flex items-center gap-1" aria-hidden>
            <span className="w-4 h-2 border border-[#1c1c1e] rounded-sm relative">
              <span className="absolute inset-y-0 left-0 w-2/3 bg-[#1c1c1e] rounded-sm" />
            </span>
          </div>
        </div>

        {/* Mail app nav */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#f2f2f7] border-b border-[#c6c6c8]">
          <button type="button" className="flex items-center text-[#007aff] text-sm font-medium" aria-hidden tabIndex={-1}>
            <ChevronLeft size={22} />
            Inbox
          </button>
          <div className="flex-1" />
          <button type="button" className="p-1 text-[#007aff]" aria-hidden tabIndex={-1}>
            <Reply size={20} />
          </button>
        </div>

        {/* Message meta */}
        <div className="px-4 py-3 bg-white border-b border-[#e5e5ea]">
          <h2 className="text-[17px] font-semibold text-[#1c1c1e] leading-tight mb-3">{displaySubject}</h2>
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-full bg-[#007aff] text-white flex items-center justify-center text-xs font-bold shrink-0"
              aria-hidden
            >
              {initials(sender)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[#1c1c1e] truncate">{sender}</span>
                <span className="text-[11px] text-[#8e8e93] shrink-0">{formatMockTime()}</span>
              </div>
              <p className="text-[11px] text-[#8e8e93] truncate">to: {toLabel || 'me'}</p>
              <p className="text-[10px] text-[#8e8e93] truncate mt-0.5">{from}</p>
            </div>
          </div>
        </div>

        {/* Body — full height; scroll with page */}
        <div className="bg-white">
          <PreviewIframe html={html} title={title} minHeight={minHeight} className="rounded-none border-0" />
        </div>

        {/* Home indicator */}
        <div className="h-5 bg-white flex items-center justify-center">
          <div className="w-28 h-1 rounded-full bg-[#1c1c1e]/80" aria-hidden />
        </div>
      </div>
      <p className="text-center text-[10px] text-[var(--color-text-muted)] mt-2 tabular-nums">
        iPhone · 390px
      </p>
    </div>
  );
}

function EmailClientMock(props) {
  if (props.device === 'mobile') return <MobileEmailMock {...props} />;
  return <DesktopEmailMock {...props} />;
}

function PreviewToolbar({
  device, onDeviceChange, onFullscreen, fullscreenLabel = 'Full screen', showFullscreen = true, variant = 'default',
}) {
  const isDark = variant === 'dark';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div
        className={`inline-flex p-0.5 rounded-lg border ${
          isDark ? 'border-white/15 bg-white/5' : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]'
        }`}
        role="tablist"
        aria-label="Preview device"
      >
        {Object.entries(DEVICE).map(([key, d]) => {
          const Icon = d.icon;
          const active = device === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onDeviceChange(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                active
                  ? isDark
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                  : isDark
                    ? 'text-white/60 hover:text-white/90'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <Icon size={14} />
              {d.label}
            </button>
          );
        })}
      </div>
      {showFullscreen && onFullscreen && (
        <button
          type="button"
          onClick={onFullscreen}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isDark
              ? 'border-white/15 bg-white/5 text-white/80 hover:text-white hover:border-white/30'
              : 'border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-action-primary)]/50 hover:text-[var(--color-action-primary)]'
          }`}
        >
          <Maximize2 size={14} />
          {fullscreenLabel}
        </button>
      )}
    </div>
  );
}

function FullscreenPreviewModal({
  open, onClose, device, onDeviceChange, mockProps,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const minHeight = device === 'mobile' ? 120 : 160;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex flex-col bg-[#0b0f14]/97 backdrop-blur-sm"
      style={{ height: '100dvh' }}
      role="dialog"
      aria-modal="true"
      aria-label="Full screen email preview"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <PreviewToolbar
          device={device}
          onDeviceChange={onDeviceChange}
          showFullscreen={false}
          variant="dark"
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close full screen preview"
        >
          <X size={20} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        <div className="flex justify-center px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-8">
          <EmailClientMock
            {...mockProps}
            device={device}
            minHeight={minHeight}
            className={device === 'mobile' ? 'mx-auto' : 'mx-auto w-full max-w-[820px]'}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function EmailDevicePreview({
  html,
  minHeight = 480,
  title = 'Email preview',
  className = '',
  subject = '',
  fromName = 'The Shakti Collective',
  fromEmail = '',
  toLabel = '',
}) {
  const [device, setDevice] = useState('desktop');
  const [fullscreen, setFullscreen] = useState(false);

  const mockProps = {
    html,
    title,
    subject,
    fromName,
    fromEmail,
    toLabel,
  };

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        <PreviewToolbar
          device={device}
          onDeviceChange={setDevice}
          onFullscreen={() => setFullscreen(true)}
        />

        <div className="flex justify-center rounded-xl border border-[var(--color-bg-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_70%,#1e293b_30%)] p-4 sm:p-6 min-h-[200px] overflow-x-auto">
          <EmailClientMock
            {...mockProps}
            device={device}
            minHeight={device === 'mobile' ? 360 : minHeight}
          />
        </div>
      </div>

      <FullscreenPreviewModal
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        device={device}
        onDeviceChange={setDevice}
        mockProps={mockProps}
      />
    </>
  );
}
