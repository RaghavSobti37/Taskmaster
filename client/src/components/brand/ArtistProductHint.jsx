import React from 'react';
import { HelpCircle } from 'lucide-react';
import { artistProductGlossary } from '@shared/marketing-content';

/** Inline glossary hint for Artist Path / OS / Workspace surfaces */
export default function ArtistProductHint({ product = 'artistOs', className = '' }) {
  const entry = artistProductGlossary[product];
  if (!entry) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-text-muted)] ${className}`}
      title={`${entry.label}: ${entry.summary}`}
    >
      <HelpCircle size={12} aria-hidden />
      <span className="sr-only">{entry.label}: {entry.summary}</span>
      <span aria-hidden>{entry.label}</span>
    </span>
  );
}
