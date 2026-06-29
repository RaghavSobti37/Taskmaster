import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React from 'react';
import { format } from 'date-fns';
import { Music } from 'lucide-react';
import { Card } from '../ui';
import ArtistPathAnswerSections from '../artistPath/ArtistPathAnswerSections';
import { formatWebinarQnaDisplay, hasArtistJourneyData } from '../../utils/leadWebinarQna';

function ReadOnlyField({ label, value, fullWidth = false }) {
  const text = value != null && String(value).trim() !== '' ? String(value).trim() : '—';
  return (
    <div className={`space-y-1.5 ${fullWidth ? 'md:col-span-2' : ''}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="px-3 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-xl text-xs font-medium text-[var(--color-text-primary)] whitespace-pre-wrap break-words min-h-[2.5rem]">
        {text}
      </div>
    </div>
  );
}

function formatSubmittedAt(d) {
  if (!d) return null;
  try {
    return formatDisplayDate(new Date(d));
  } catch {
    return null;
  }
}

export default function LeadArtistJourneySection({ lead }) {
  if (!hasArtistJourneyData(lead)) return null;

  const webinarQnaText = formatWebinarQnaDisplay(lead.webinarQnaItems);
  const responses = lead.artistPathResponses || [];

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
          Artist &amp; journey
        </h3>
        <p className="text-[10px] text-[var(--color-text-muted)] mb-4">
          Populated from webinar/import. Empty if not provided.
        </p>
      </div>

      <Card className="p-5 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReadOnlyField label="Artist Type" value={lead.artistType} />
          <ReadOnlyField label="Full-Time Willingness" value={lead.fullTimeWillingness} />
          <ReadOnlyField label="Primary Role" value={lead.primaryRole} />
          <ReadOnlyField label="Learning Goal" value={lead.learningGoal} />
          <ReadOnlyField label="Learned Music" value={lead.learnedMusic} />
          <ReadOnlyField label="Q&A Answered" value={webinarQnaText} />
          <ReadOnlyField label="Current Journey" value={lead.currentJourney} fullWidth />
        </div>
      </Card>

      {responses.length > 0 && (
        <Card className="p-5 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
            <Music size={12} className="text-[var(--color-action-primary)]" />
            Artist Path questionnaire
          </h4>
          {responses.map((resp) => (
            <div key={resp._id} className="space-y-3">
              {responses.length > 1 && resp.submittedAt && (
                <p className="text-[10px] font-mono text-[var(--color-text-muted)]">
                  Submitted {formatSubmittedAt(resp.submittedAt)}
                </p>
              )}
              <ArtistPathAnswerSections answers={resp.answers} />
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
