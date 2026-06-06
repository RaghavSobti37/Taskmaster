import React from 'react';
import { FaInstagram, FaSpotify, FaYoutube } from 'react-icons/fa';
import { collectSocialLinks } from '../../utils/artistPathDisplay';

const ICONS = {
  instagram: FaInstagram,
  spotify: FaSpotify,
  youtube: FaYoutube,
};

export default function ArtistPathSocialLinks({ answers }) {
  const links = collectSocialLinks(answers);
  if (!links.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {links.map(({ key, label, iconClass, url, handle }) => {
        const Icon = ICONS[key];
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={url}
            className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50 hover:border-[var(--color-action-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors min-w-[9.5rem]"
          >
            <Icon className={`${iconClass} shrink-0`} size={18} aria-hidden />
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">{label}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] truncate">{handle}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}
