import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input } from '../../../components/ui';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { NexusModal } from '../../../components/ui/modals';
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES, formatInr } from './artistOsConstants';
import { Upload, ExternalLink, Plus } from 'lucide-react';
import { useArtistOsFinance, useCreateArtistFinanceEntry } from '../../../hooks/queries/artistOs';

const EMPTY = { type: 'expense', category: 'Misc', amount: '', entryDate: '', description: '' };

export default function ArtistFinanceTab({ artistId, isPreview }) {
  const { data: month, isLoading, isError, error, refetch } = useArtistOsFinance(artistId, null, !!artistId && !isPreview);
  const createMutation = useCreateArtistFinanceEntry();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const categoryOptions = form.type === 'revenue' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.entryDate) return alert('Amount and date required');
    await createMutation.mutateAsync({
      artistId,
      data: {
        type: form.type,
        category: form.category,
        amount: Number(form.amount),
        entryDate: form.entryDate,
        description: form.description,
      },
    });
    setOpen(false);
    setForm(EMPTY);
  };

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      <Card className="p-5 rounded-2xl space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">{month?.month || 'This month'}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">Revenue</p>
            <p className="text-2xl font-black text-emerald-600">{formatInr(month?.revenue ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">Expenses</p>
            <p className="text-2xl font-black text-rose-500">{formatInr(month?.expenses ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">Profit</p>
            <p className="text-2xl font-black">{formatInr(month?.profit ?? month?.net ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">Expense Ratio</p>
            <p className="text-2xl font-black">{month?.expenseRatio ?? 0}%</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 rounded-2xl">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Income by Category</h4>
          <div className="space-y-2">
            {REVENUE_CATEGORIES.map((cat) => (
              <div key={cat} className="flex justify-between text-xs">
                <span>{cat}</span>
                <span className="font-bold text-emerald-600">{formatInr(month?.byCategory?.[cat] ?? 0)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 rounded-2xl">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Expense Breakdown</h4>
          <div className="space-y-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <div key={cat} className="flex justify-between text-xs">
                <span>{cat}</span>
                <span className="font-bold">{formatInr(month?.byCategory?.[cat] ?? 0)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {!isPreview && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Manual Entry
          </Button>
          <Link to="/management?tab=finance" className="inline-flex">
            <Button size="sm" variant="secondary">
              <Upload size={14} /> Org Finance OCR
              <ExternalLink size={12} className="ml-1 opacity-60" />
            </Button>
          </Link>
        </div>
      )}

      <NexusModal isOpen={open} onClose={() => setOpen(false)} title="Finance Entry" showFooter={false}>
        <form onSubmit={submit} className="space-y-3">
          <label className="text-xs font-bold block">
            Type
            <select
              className="w-full mt-1 border rounded px-2 py-1.5 text-xs"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value, category: e.target.value === 'revenue' ? 'Gig' : 'Misc' })}
            >
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label className="text-xs font-bold block">
            Category
            <select className="w-full mt-1 border rounded px-2 py-1.5 text-xs" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <Input label="Amount (₹) *" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input label="Date *" type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>Save</Button>
          </div>
        </form>
      </NexusModal>
    </ArtistOsQueryShell>
  );
}
