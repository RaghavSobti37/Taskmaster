import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, Mail, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '../ui';
import { ModalShell, ModalHeader, ModalBody, ModalFooter } from '../ui/modals';
import { useToast } from '../../contexts/ToastContext';
import {
  buildEmailShareUrl,
  buildShareMessage,
  buildWhatsAppShareUrl,
  resolveArtistShareUrl,
} from '../../utils/artistShareLinks';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  return ok;
}

export default function ArtistShareModal({
  isOpen,
  onClose,
  artistId,
  artistName,
  artistSlug,
  shareLinkMutation,
}) {
  const toast = useToast();
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadShareUrl = useCallback(async () => {
    if (!artistId) return;
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const { url } = await shareLinkMutation.mutateAsync(artistId);
      setShareUrl(
        resolveArtistShareUrl({
          origin: window.location.origin,
          artistId,
          artistSlug,
          apiUrl: url,
        })
      );
    } catch {
      const fallback = resolveArtistShareUrl({
        origin: window.location.origin,
        artistId,
        artistSlug,
      });
      setShareUrl(fallback);
      setError('Could not create invite link. Using public profile URL instead.');
    } finally {
      setLoading(false);
    }
  }, [artistId, artistSlug, shareLinkMutation]);

  useEffect(() => {
    if (!isOpen) return;
    loadShareUrl();
  }, [isOpen, loadShareUrl]);

  const handleClose = () => {
    setCopied(false);
    setError('');
    onClose();
  };

  const shareMessage = shareUrl ? buildShareMessage(artistName, shareUrl) : '';
  const emailSubject = artistName ? `Artist profile: ${artistName}` : 'Artist profile';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      const ok = await copyText(shareUrl);
      if (!ok) throw new Error('copy failed');
      setCopied(true);
      toast.success('Link copied to clipboard');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link. Select the URL and copy manually.');
    }
  };

  const openWhatsApp = () => {
    if (!shareUrl) return;
    window.open(buildWhatsAppShareUrl(shareMessage), '_blank', 'noopener,noreferrer');
  };

  const openEmail = () => {
    if (!shareUrl) return;
    window.location.href = buildEmailShareUrl(emailSubject, shareMessage);
  };

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} size="md" ariaLabel="Share artist">
      <ModalHeader
        title="Share artist"
        subtitle={artistName}
        onClose={handleClose}
        icon={Share2}
        iconStyle={{ background: 'var(--color-action-primary)', color: '#fff' }}
        prominentTitle
      />
      <ModalBody className="space-y-5">
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          Send this link so others can view the artist profile or claim the workspace.
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--color-text-muted)]">
            <Loader2 size={18} className="animate-spin text-[var(--color-action-primary)]" />
            Preparing share link…
          </div>
        ) : (
          <>
            {error && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{error}</p>
            )}

            <div className="rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                Share link
              </p>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
                <span className="flex-1 min-w-0 text-xs font-mono text-[var(--color-text-secondary)] break-all leading-relaxed">
                  {shareUrl || '—'}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!shareUrl}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[var(--color-action-primary)] text-white disabled:opacity-50"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!shareUrl}
                className="group flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-action-primary)]/40 hover:bg-[var(--color-action-primary)]/5 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-[var(--color-action-primary)]/10 text-[var(--color-action-primary)] group-hover:bg-[var(--color-action-primary)] group-hover:text-white transition-colors">
                  <Copy size={20} />
                </span>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">Copy link</span>
              </button>

              <button
                type="button"
                onClick={openWhatsApp}
                disabled={!shareUrl}
                className="group flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <MessageCircle size={20} />
                </span>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={openEmail}
                disabled={!shareUrl}
                className="group flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] hover:border-sky-500/40 hover:bg-sky-500/5 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-sky-500/10 text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                  <Mail size={20} />
                </span>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">Email</span>
              </button>
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={handleClose}>
          Done
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}
