import React, { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { orgInitials } from '../../../constants/orgCreateOptions';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export default function OrgLogoPicker({ name, logoUrl, onChange, onError, disabled = false }) {
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('Choose a PNG or JPG image');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      onError?.('Logo must be 2 MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result);
      onError?.('');
    };
    reader.onerror = () => onError?.('Could not read image file');
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        className="group relative shrink-0"
        aria-label="Upload organization logo"
        disabled={disabled}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="h-16 w-16 rounded-lg border border-[var(--color-bg-border)] object-cover"
          />
        ) : (
          <span className="tm-org-avatar flex h-16 w-16 items-center justify-center text-lg">
            {orgInitials(name)}
          </span>
        )}
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] text-[var(--color-action-primary)] shadow-sm group-hover:bg-[var(--color-bg-elevated)]">
          <ImagePlus size={12} aria-hidden />
        </span>
      </button>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-[var(--color-text-primary)]">Organization logo</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Optional. PNG or JPG, up to 2 MB.</p>
        {logoUrl && !disabled && (
          <button
            type="button"
            className="mt-1 text-xs font-medium text-[var(--color-action-primary)] hover:underline"
            onClick={() => onChange(null)}
          >
            Remove logo
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
