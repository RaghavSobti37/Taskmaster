import React, { useEffect, useMemo } from 'react';
import { displayNameForResendEmail } from '../../constants/resendFromEmails';
import { useEmailStreams } from '../../hooks/useTaskmasterQueries';

export default function ResendFromEmailPicker({
  value,
  onChange,
  streamSlug,
  onStreamChange,
}) {
  const { data: streams = [], isLoading } = useEmailStreams();
  const activeStreams = useMemo(
    () => [...streams].filter((s) => s.isActive !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [streams],
  );

  const selectedStream = useMemo(
    () => activeStreams.find((s) => s.slug === streamSlug) || activeStreams.find((s) => s.isDefault) || activeStreams[0],
    [activeStreams, streamSlug],
  );

  useEffect(() => {
    if (!onStreamChange || !selectedStream) return;
    if (!streamSlug && selectedStream.slug) {
      onStreamChange(selectedStream.slug);
    }
  }, [selectedStream, streamSlug, onStreamChange]);

  useEffect(() => {
    if (!selectedStream || !onChange) return;
    const allowed = selectedStream.fromEmails || [selectedStream.defaultFromEmail];
    if (value && allowed.map((e) => e.toLowerCase()).includes(value.toLowerCase())) return;
    if (selectedStream.defaultFromEmail) {
      onChange(selectedStream.defaultFromEmail);
    }
  }, [selectedStream?._id, selectedStream?.defaultFromEmail, onChange, value]);

  const handlePickStream = (stream) => {
    onStreamChange?.(stream.slug);
    onChange(stream.defaultFromEmail);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          Sending stream (subdomain)
        </p>
        {isLoading ? (
          <p className="text-xs text-[var(--color-text-muted)]">Loading streams…</p>
        ) : activeStreams.length === 0 ? (
          <p className="text-xs text-amber-500 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            No sending streams available. Check Resend setup or reload the page.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeStreams.map((stream) => {
              const selected = (streamSlug || selectedStream?.slug) === stream.slug;
              return (
                <button
                  key={stream.slug}
                  type="button"
                  onClick={() => handlePickStream(stream)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    selected
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-[var(--color-bg-border)] hover:border-violet-500/40'
                  }`}
                >
                  <p className="font-semibold text-sm">{stream.name}</p>
                  <p className="text-[10px] font-mono text-[var(--color-text-muted)]">{stream.domain}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedStream && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            From address (@{selectedStream.domain})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(selectedStream.fromEmails?.length ? selectedStream.fromEmails : [selectedStream.defaultFromEmail]).map((email) => {
              const selected = value === email;
              return (
                <button
                  key={email}
                  type="button"
                  onClick={() => onChange(email)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selected
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-[var(--color-bg-border)] hover:border-violet-500/40'
                  }`}
                >
                  <p className="font-semibold text-sm">{displayNameForResendEmail(email)}</p>
                  <p className="text-xs text-[var(--color-text-muted)] font-mono">{email}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
