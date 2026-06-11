import React, { useState } from 'react';
import { Card, Badge, DataTable, Button, Input } from '../../../components/ui';
import { NexusModal } from '../../../components/ui/modals';
import { INQUIRY_STATUSES, BOOKING_PIPELINE_STAGES, formatInr } from './artistOsConstants';
import { Plus } from 'lucide-react';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import {
  useArtistOsInquiries,
  useCreateArtistInquiry,
  useUpdateArtistInquiry,
} from '../../../hooks/queries/artistOs';

const statusVariant = (status) => INQUIRY_STATUSES.find((s) => s.id === status)?.variant || 'slate';

const EMPTY = {
  clientName: '', source: 'manual', eventDate: '', expectedBudget: '', email: '', phone: '', eventName: '',
};

export default function ArtistInquiriesTab({ artistId, isPreview }) {
  const { data: inquiries = [], isLoading, isError, error, refetch } = useArtistOsInquiries(artistId, !!artistId && !isPreview);
  const createMutation = useCreateArtistInquiry();
  const updateMutation = useUpdateArtistInquiry();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const columns = [
    {
      header: 'Client',
      render: (row) => (
        <div>
          <p className="text-xs font-bold">{row.clientName}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">{row.source}</p>
        </div>
      ),
    },
    {
      header: 'Date',
      render: (row) => (
        <span className="text-xs">
          {row.eventDate ? new Date(row.eventDate).toLocaleDateString('en-IN') : '—'}
        </span>
      ),
    },
    { header: 'Budget', render: (row) => <span className="text-xs font-bold">{formatInr(row.expectedBudget)}</span> },
    {
      header: 'Status',
      render: (row) => (
        <select
          className="text-[10px] font-bold uppercase bg-transparent border border-[var(--color-bg-border)] rounded px-1 py-0.5"
          value={row.status}
          disabled={isPreview || updateMutation.isPending}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateMutation.mutate({ artistId, inquiryId: row._id, data: { status: e.target.value } })}
        >
          {INQUIRY_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      ),
    },
    { header: 'Manager', render: (row) => <span className="text-xs">{row.assignedManagerName || '—'}</span> },
  ];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.clientName) return alert('Client name required');
    await createMutation.mutateAsync({
      artistId,
      data: {
        ...form,
        expectedBudget: Number(form.expectedBudget) || 0,
        eventDate: form.eventDate || undefined,
      },
    });
    setOpen(false);
    setForm(EMPTY);
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      <div className="flex flex-wrap gap-1">
        {BOOKING_PIPELINE_STAGES.map((s) => (
          <Badge key={s.id} variant={s.variant}>{s.label}</Badge>
        ))}
      </div>

      {!isPreview && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Add Inquiry
          </Button>
        </div>
      )}

      <DataTable columns={columns} data={inquiries} loading={false} emptyTitle="No inquiries yet" />

      <NexusModal isOpen={open} onClose={() => setOpen(false)} title="Add Inquiry" showFooter={false}>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Client Name *" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          <Input label="Event Name" value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Event Date" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
          <Input label="Expected Budget (₹)" type="number" value={form.expectedBudget} onChange={(e) => setForm({ ...form, expectedBudget: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>Save</Button>
          </div>
        </form>
      </NexusModal>
    </ArtistOsQueryShell>
  );
}
