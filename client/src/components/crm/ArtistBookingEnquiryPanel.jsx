import React from 'react';
import { Music, ExternalLink } from 'lucide-react';
import { Card, Badge } from '../ui';
import { getBookingEnquiryRows, isArtistBookingEnquiry } from '../../utils/artistBookingEnquiry';

export default function ArtistBookingEnquiryPanel({ lead, className = '' }) {
  if (!isArtistBookingEnquiry(lead)) return null;

  const rows = getBookingEnquiryRows(lead);
  const meta = lead.metadata || {};
  const receivedAt = lead.createdAt
    ? new Date(lead.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <section className={className}>
      <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
        <Music size={14} className="text-[var(--color-action-primary)]" />
        Website Booking Enquiry
        <Badge variant="info" className="!text-[9px] ml-1">TSC /query</Badge>
      </h3>
      <Card className="p-5 bg-emerald-500/5 border-emerald-500/25 space-y-4">
        {(lead.email || lead.phone) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 pb-3 border-b border-emerald-500/20">
            {lead.email && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Email</p>
                <p className="text-xs font-bold text-[var(--color-text-primary)]">{lead.email}</p>
              </div>
            )}
            {lead.phone && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">Phone</p>
                <p className="text-xs font-bold text-[var(--color-text-primary)]">{lead.phone}</p>
              </div>
            )}
          </div>
        )}
        {receivedAt && (
          <p className="text-[10px] font-mono text-[var(--color-text-muted)]">
            Submitted {receivedAt}
          </p>
        )}
        {rows.length > 0 ? (
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {rows.map(({ key, label, value }) => (
              <div key={key} className={key === 'vision' ? 'md:col-span-2' : ''}>
                <dt className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                  {label}
                </dt>
                <dd className="text-xs font-bold text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">
            No extended booking fields were captured for this submission.
          </p>
        )}
        {meta.taskId && (
          <div className="pt-3 border-t border-emerald-500/20">
            <a
              href={`/todo?highlight=${meta.taskId}`}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-action-primary)] hover:underline"
            >
              <ExternalLink size={12} />
              View linked enquiry task
            </a>
          </div>
        )}
      </Card>
    </section>
  );
}
