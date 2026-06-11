import React, { useState } from 'react';
import { Badge, DataTable, Button, Input } from '../../../components/ui';
import { NexusModal } from '../../../components/ui/modals';
import { formatInr } from './artistOsConstants';
import { Plus } from 'lucide-react';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { useArtistOsGigs, useCreateArtistGig, useUpdateArtistGig } from '../../../hooks/queries/artistOs';

const EMPTY = { name: '', location: '', gigDate: '', rate: '', expense: '' };

export default function ArtistGigsTab({ artistId, isPreview }) {
  const { data: gigs = [], isLoading, isError, error, refetch } = useArtistOsGigs(artistId, !!artistId && !isPreview);
  const createMutation = useCreateArtistGig();
  const updateMutation = useUpdateArtistGig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const columns = [
    { header: 'SR', render: (row) => <span className="text-xs font-mono">{row.sr}</span> },
    { header: 'Gig', render: (row) => <span className="text-xs font-bold">{row.name}</span> },
    { header: 'Location', render: (row) => <span className="text-xs">{row.location || '—'}</span> },
    {
      header: 'Date',
      render: (row) => <span className="text-xs">{new Date(row.gigDate).toLocaleDateString('en-IN')}</span>,
    },
    { header: 'Rate', render: (row) => <span className="text-xs font-bold">{formatInr(row.rate)}</span> },
    { header: 'Expense', render: (row) => <span className="text-xs">{formatInr(row.expense)}</span> },
    { header: 'Profit', render: (row) => <span className="text-xs font-bold text-emerald-600">{formatInr(row.profit ?? (row.rate - row.expense))}</span> },
    {
      header: 'Payment',
      render: (row) => (
        isPreview ? (
          <Badge variant={row.paymentStatus === 'paid' ? 'success' : 'warning'}>{row.paymentStatus}</Badge>
        ) : (
          <select
            className="text-[10px] font-bold uppercase bg-transparent border border-[var(--color-bg-border)] rounded px-1 py-0.5"
            value={row.paymentStatus || 'pending'}
            disabled={updateMutation.isPending}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateMutation.mutate({ artistId, gigId: row._id, data: { paymentStatus: e.target.value } })}
          >
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="partial">partial</option>
          </select>
        )
      ),
    },
  ];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.gigDate) return alert('Name and date required');
    await createMutation.mutateAsync({
      artistId,
      data: {
        name: form.name,
        location: form.location,
        gigDate: form.gigDate,
        rate: Number(form.rate) || 0,
        expense: Number(form.expense) || 0,
      },
    });
    setOpen(false);
    setForm(EMPTY);
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      {!isPreview && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Add Gig
          </Button>
        </div>
      )}
      <DataTable columns={columns} data={gigs} loading={false} emptyTitle="No confirmed gigs" />

      <NexusModal isOpen={open} onClose={() => setOpen(false)} title="Add Confirmed Gig" showFooter={false}>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Gig Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input label="Date *" type="date" value={form.gigDate} onChange={(e) => setForm({ ...form, gigDate: e.target.value })} />
          <Input label="Rate (₹)" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          <Input label="Expense (₹)" type="number" value={form.expense} onChange={(e) => setForm({ ...form, expense: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>Save</Button>
          </div>
        </form>
      </NexusModal>
    </ArtistOsQueryShell>
  );
}
