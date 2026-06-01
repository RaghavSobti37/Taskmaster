import React, { useMemo } from 'react';
import { buildDisplaySegments } from '../../utils/mentionTokens';

const externalUrl = (link) => {
  const trimmed = String(link || '').trim();
  if (!trimmed) return null;
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

const MentionRichText = ({ text, users = [], assets = [], className = '', inline = false, truncate = false, title }) => {
  const segments = useMemo(
    () => buildDisplaySegments(text, users, assets),
    [text, users, assets]
  );

  if (!text) return null;

  const Tag = inline || truncate ? 'span' : 'p';
  const layoutClass = truncate
    ? 'block min-w-0 truncate'
    : inline
      ? 'inline break-words'
      : 'whitespace-pre-wrap break-words';

  return (
    <Tag className={`${layoutClass} ${className}`.trim()} title={title}>
      {segments.map((seg, index) => {
        if (seg.type === 'text') {
          return <span key={index}>{seg.value}</span>;
        }
        if (seg.type === 'user') {
          return (
            <span
              key={index}
              className="text-[var(--color-action-primary)] font-semibold"
              title={seg.displayName}
            >
              @{seg.label}
            </span>
          );
        }
        if (seg.type === 'asset') {
          const href = externalUrl(seg.link);
          if (href) {
            return (
              <a
                key={index}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-brand-teal)] font-semibold hover:underline"
                title={`Open ${seg.displayName}`}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                #{seg.label}
              </a>
            );
          }
          return (
            <span key={index} className="text-[var(--color-brand-teal)] font-semibold">
              #{seg.label}
            </span>
          );
        }
        return null;
      })}
    </Tag>
  );
};

export default MentionRichText;
