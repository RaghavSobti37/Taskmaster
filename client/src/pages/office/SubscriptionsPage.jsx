import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CreditCard, Plus, Search, Trash2 } from 'lucide-react';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { useUsdInrRate } from '../../hooks/useUsdInrRate';
import { inrToUsd, roundMoney } from '../../utils/usdInr';
import UsdInrAmountFields from '../../components/finance/UsdInrAmountFields';
import {
  PageContainer,
  PageHeader,
  Card,
  Button,
  Input,
  NexusModal,
  ModalFooter,
  PageSkeleton,
  DataLoading,
} from '../../components/ui';
import { useUnsavedChanges, stableJsonEqual, cloneSnapshot } from '../../hooks/useUnsavedChanges';

const SUBSCRIPTION_TYPES = ['Software', 'SaaS', 'Hosting', 'Domain', 'Service', 'Other'];
const PERIODICITY_OPTIONS = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'One-time'];
const PAYMENT_MODES = ['Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Cash', 'Other'];

const EMPTY_FORM = {
  name: '',
  amount: '',
  amountUsd: '',
  dueDate: '',
  type: 'Software',
  periodicity: 'Monthly',
  paymentMode: 'Credit Card',
  usedBy: '',
  notes: '',
};

const formatInr = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const toFormData = (sub, rate) => {
  const amount = sub.amount != null ? roundMoney(sub.amount) : '';
  const hasRate = Number.isFinite(rate) && rate > 0;
  return {
    name: sub.name || '',
    amount: amount !== '' ? String(amount) : '',
    amountUsd: amount !== '' && hasRate ? String(inrToUsd(amount, rate)) : '',
    dueDate: sub.dueDate ? new Date(sub.dueDate).toISOString().slice(0, 10) : '',
    type: SUBSCRIPTION_TYPES.includes(sub.type) ? sub.type : 'Software',
    periodicity: PERIODICITY_OPTIONS.includes(sub.periodicity) ? sub.periodicity : 'Monthly',
    paymentMode: PAYMENT_MODES.includes(sub.paymentMode) ? sub.paymentMode : 'Credit Card',
    usedBy: sub.usedBy?._id || sub.usedBy || '',
    notes: sub.notes || '',
  };
};

const toPayload = (form) => ({
  name: form.name.trim(),
  amount: roundMoney(form.amount) || 0,
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
  const [formBaseline, setFormBaseline] = useState(EMPTY_FORM);
  const rateAppliedRef = useRef(false);
  const queryClient = useQueryClient();
  const { data: users = [] } = useUserDirectory();

  const { data: rateData } = useUsdInrRate({ enabled: isModalOpen });
  const usdInrRate = rateData?.rate;

  useEffect(() => {
    if (!isModalOpen) {
      rateAppliedRef.current = false;
      return;
    }
    if (!Number.isFinite(usdInrRate) || usdInrRate <= 0 || rateAppliedRef.current) return;
    rateAppliedRef.current = true;
    setFormData((prev) => {
      if (prev.amount === '' || prev.amount === '.') return prev;
      return {
        ...prev,
        amountUsd: String(inrToUsd(prev.amount, usdInrRate)),
      };
    });
  }, [isModalOpen, usdInrRate]);

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
    setFormBaseline(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (sub) => {
    const loaded = toFormData(sub, usdInrRate);
    setEditing(sub);
    setFormData(loaded);
    setFormBaseline(cloneSnapshot(loaded));
    setIsModalOpen(true);
  };

  const hasSubscriptionEdits =
    isModalOpen && editing && !stableJsonEqual(formData, formBaseline);

  const { revert: revertSubscriptionEdits } = useUnsavedChanges({
    baseline: formBaseline,
    draft: formData,
    setDraft: setFormData,
    hasChanges: hasSubscriptionEdits,
    onSave: () => saveMutation.mutate(toPayload(formData)),
    enabled: false,
    isSaving: saveMutation.isPending,
  });

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
        footer={
          editing ? (
            <ModalFooter>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={revertSubscriptionEdits}
                disabled={!hasSubscriptionEdits || saveMutation.isPending}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => saveMutation.mutate(toPayload(formData))}
                disabled={!hasSubscriptionEdits || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </ModalFooter>
          ) : null
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing) saveMutation.mutate(toPayload(formData));
          }}
        >
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            icon={CreditCard}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <UsdInrAmountFields
                enabled={isModalOpen}
                inrValue={formData.amount}
                usdValue={formData.amountUsd}
                onInrChange={(amount) => setFormData((prev) => ({ ...prev, amount }))}
                onUsdChange={(amountUsd) => setFormData((prev) => ({ ...prev, amountUsd }))}
                inrRequired
              />
            </div>
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
            {!editing && (
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Add Subscription'}
              </Button>
            )}
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
