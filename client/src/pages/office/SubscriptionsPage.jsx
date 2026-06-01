import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CreditCard, Plus, Search, Trash2 } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import {
  PageContainer,
  PageHeader,
  Card,
  Button,
  Input,
  NexusModal,
  PageSkeleton,
  DataLoading,
} from '../../components/ui';

const SUBSCRIPTION_TYPES = ['Software', 'SaaS', 'Hosting', 'Domain', 'Service', 'Other'];
const PERIODICITY_OPTIONS = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'One-time'];
const PAYMENT_MODES = ['Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Cash', 'Other'];

const EMPTY_FORM = {
  name: '',
  amount: '',
  dueDate: '',
  type: 'Software',
  periodicity: 'Monthly',
  paymentMode: 'Credit Card',
  usedBy: '',
  notes: '',
};

const formatInr = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const toFormData = (sub) => ({
  name: sub.name || '',
  amount: sub.amount != null ? String(sub.amount) : '',
  dueDate: sub.dueDate ? new Date(sub.dueDate).toISOString().slice(0, 10) : '',
  type: SUBSCRIPTION_TYPES.includes(sub.type) ? sub.type : 'Software',
  periodicity: PERIODICITY_OPTIONS.includes(sub.periodicity) ? sub.periodicity : 'Monthly',
  paymentMode: PAYMENT_MODES.includes(sub.paymentMode) ? sub.paymentMode : 'Credit Card',
  usedBy: sub.usedBy?._id || sub.usedBy || '',
  notes: sub.notes || '',
});

const toPayload = (form) => ({
  name: form.name.trim(),
  amount: Number(form.amount) || 0,
  dueDate: form.dueDate || undefined,
  type: form.type,
  periodicity: form.periodicity,
  paymentMode: form.paymentMode,
  usedBy: form.usedBy || undefined,
  notes: form.notes || undefined,
});

const SubscriptionsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();
  const { data: users = [] } = useUserDirectory();

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => (await axios.get('/api/subscriptions')).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) =>
      editing
        ? axios.put(`/api/subscriptions/${editing._id}`, data)
        : axios.post('/api/subscriptions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setIsModalOpen(false);
      setEditing(null);
      setFormData(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => axios.delete(`/api/subscriptions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setIsModalOpen(false);
      setEditing(null);
      setFormData(EMPTY_FORM);
    },
  });

  const filtered = subscriptions.filter((sub) => {
    const haystack = [
      sub.name,
      sub.type,
      sub.usedBy?.name,
      sub.paymentMode,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const openCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (sub) => {
    setEditing(sub);
    setFormData(toFormData(sub));
    setIsModalOpen(true);
  };

  if (isLoading && !subscriptions.length) {
    return (
      <PageContainer className="!py-4">
        <PageSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Subscriptions"
        subtitle="Track recurring software and service subscriptions."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Add Subscription
          </Button>
        }
      />

      <Card className="p-4 space-y-4">
        <Input
          placeholder="Search subscriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={Search}
        />
        <div className="overflow-x-auto border border-[var(--color-bg-border)] rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Amount</th>
                <th className="px-3 py-2 text-left">Due Date</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Periodicity</th>
                <th className="px-3 py-2 text-left">Used By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6}>
                    <DataLoading />
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                    No subscriptions yet. Add one to get started.
                  </td>
                </tr>
              )}
              {!isLoading &&
                filtered.map((sub) => (
                  <tr
                    key={sub._id}
                    className="border-t border-[var(--color-bg-border)] cursor-pointer hover:bg-[var(--color-bg-secondary)]/40"
                    onClick={() => openEdit(sub)}
                  >
                    <td className="px-3 py-2 font-bold">{sub.name}</td>
                    <td className="px-3 py-2">{formatInr(sub.amount)}</td>
                    <td className="px-3 py-2">{formatDate(sub.dueDate)}</td>
                    <td className="px-3 py-2">{sub.type}</td>
                    <td className="px-3 py-2">{sub.periodicity}</td>
                    <td className="px-3 py-2">{sub.usedBy?.name || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <NexusModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? 'Edit Subscription' : 'Add Subscription'}
        showFooter={false}
        width="max-w-3xl"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(toPayload(formData));
          }}
        >
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            icon={CreditCard}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Amount (INR)"
              type="number"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
            <Input
              label="Due Date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs mb-1">Type</label>
              <select
                className="w-full border rounded-lg p-2 bg-transparent"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {SUBSCRIPTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Periodicity</label>
              <select
                className="w-full border rounded-lg p-2 bg-transparent"
                value={formData.periodicity}
                onChange={(e) => setFormData({ ...formData, periodicity: e.target.value })}
              >
                {PERIODICITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Payment Mode</label>
              <select
                className="w-full border rounded-lg p-2 bg-transparent"
                value={formData.paymentMode}
                onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1">Used By</label>
            <select
              className="w-full border rounded-lg p-2 bg-transparent"
              value={formData.usedBy}
              onChange={(e) => setFormData({ ...formData, usedBy: e.target.value })}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Delete subscription "${editing.name}"?`)) {
                    deleteMutation.mutate(editing._id);
                  }
                }}
              >
                <Trash2 size={14} /> Delete
              </Button>
            )}
          </div>
        </form>
      </NexusModal>
    </PageContainer>
  );
};

export default SubscriptionsPage;
