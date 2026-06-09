import React from 'react';
import { ExternalLink } from 'lucide-react';
import { answerLabel } from '../../utils/artistPathLabels';
import { collectGroupedAnswers, isUrl, LINK_ANSWER_KEYS } from '../../utils/artistPathDisplay';

function AnswerValue({ fieldKey, value, links }) {
  const text = String(value || '').trim();
  if (!text) return null;

  if (links || LINK_ANSWER_KEYS.has(fieldKey) || isUrl(text)) {
    const href = isUrl(text) ? text : `https://${text.replace(/^\/\//, '')}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-action-primary)] hover:underline break-all"
      >
        <span className="line-clamp-2">{text.replace(/^https?:\/\//i, '')}</span>
        <ExternalLink size={12} className="shrink-0 opacity-70" />
      </a>
    );
  }

  const isLong = text.length > 120;
  return (
    <p className={`text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap break-words ${isLong ? 'text-[13px]' : ''}`}>
      {text}
    </p>
  );
}

function AnswerRow({ fieldKey, value, links, fullWidth }) {
  const text = String(value);
  const isLong = fullWidth || text.length > 100;
  return (
    <div
      className={`rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/40 px-4 py-3 h-full min-h-[4.5rem] flex flex-col ${
        isLong ? 'md:col-span-2' : ''
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
        {answerLabel(fieldKey)}
      </p>
      <AnswerValue fieldKey={fieldKey} value={value} links={links} />
    </div>
  );
}

export default function ArtistPathAnswerSections({ answers }) {
  const groups = collectGroupedAnswers(answers);

  if (!groups.length) {
    return <p className="text-sm text-[var(--color-text-muted)]">No questionnaire answers</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3 pb-1 border-b border-[var(--color-bg-border)]">
            {group.title}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map(({ key, value }) => (
              <AnswerRow
                key={key}
                fieldKey={key}
                value={value}
                links={group.links}
                fullWidth={group.fullWidth || key === 'artistIdentity'}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
