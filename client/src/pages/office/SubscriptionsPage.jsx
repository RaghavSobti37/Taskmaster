import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { useUsdInrRate } from '../../hooks/useUsdInrRate';
import { inrToUsd, roundMoney } from '../../utils/usdInr';
import UsdInrAmountFields from '../../components/finance/UsdInrAmountFields';
import MemberSelect from '../../components/forms/MemberSelect';
import { Button, Input, PageLoadGuard, PageSkeleton, DataTable, ListPageLayout, SearchInput, UserLabel } from '../../components/ui';
import { NexusModal, ModalFooter } from '../../components/ui/modals';;
import { distributionFromField } from '../../utils/buildChartSeries';
import { useConfirm } from '../../contexts/confirmContext';
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
  usedBy: [],
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

/** Normalize each line item to equivalent monthly INR from its billing periodicity. */
const PERIODICITY_MONTHLY_FACTOR = {
  Monthly: 1,
  Quarterly: 1 / 3,
  'Half-yearly': 1 / 6,
  Yearly: 1 / 12,
  'One-time': 0,
};

const subscriptionMonthlyInr = (sub) => {
  const amount = Number(sub?.amount) || 0;
  const factor = PERIODICITY_MONTHLY_FACTOR[sub?.periodicity] ?? 1;
  return amount * factor;
};

const subscriptionYearlyInr = (sub) => subscriptionMonthlyInr(sub) * 12;

const normalizeUsedByUsers = (usedBy) => {
  if (!usedBy) return [];
  return Array.isArray(usedBy) ? usedBy : [usedBy];
};

const usedByIdsFromSub = (sub) =>
  normalizeUsedByUsers(sub?.usedBy)
    .map((entry) => (typeof entry === 'object' ? entry?._id : entry))
    .filter(Boolean);

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
    usedBy: usedByIdsFromSub(sub),
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
  usedBy: (form.usedBy || []).filter(Boolean),
  notes: form.notes || undefined,
});

const SubscriptionsPage = () => {
  const { confirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formBaseline, setFormBaseline] = useState(EMPTY_FORM);
  const rateAppliedRef = useRef(false);
  const queryClient = useQueryClient();

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
    const usedByNames = normalizeUsedByUsers(sub.usedBy)
      .map((user) => user?.name)
      .filter(Boolean);
    const haystack = [
      sub.name,
      sub.type,
      ...usedByNames,
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

  const { totalMonthlyInr, totalYearlyInr } = useMemo(() => {
    let monthly = 0;
    for (const sub of subscriptions) {
      monthly += subscriptionMonthlyInr(sub);
    }
    return { totalMonthlyInr: monthly, totalYearlyInr: monthly * 12 };
  }, [subscriptions]);

  const typeChart = useMemo(
    () => distributionFromField(subscriptions, 'type'),
    [subscriptions]
  );

  const subscriptionColumns = [
    { header: 'Name', sortKey: 'name', render: (sub) => <span className="font-bold">{sub.name}</span> },
    {
      header: 'Amount',
      sortKey: 'amount',
      sortFn: (sub) => Number(sub.amount) || 0,
      render: (sub) => formatInr(sub.amount),
    },
    {
      header: 'Due Date',
      sortKey: 'dueDate',
      sortFn: (sub) => (sub.dueDate ? new Date(sub.dueDate) : null),
      render: (sub) => formatDate(sub.dueDate),
    },
    { header: 'Type', sortKey: 'type', render: (sub) => sub.type },
    { header: 'Periodicity', sortKey: 'periodicity', render: (sub) => sub.periodicity },
    {
      header: 'Used By',
      sortKey: 'usedBy',
      sortFn: (sub) =>
        normalizeUsedByUsers(sub.usedBy)
          .map((user) => user?.name || '')
          .join(', '),
      render: (sub) => {
        const users = normalizeUsedByUsers(sub.usedBy).filter((user) => user?.name || user?._id);
        if (!users.length) {
          return <span className="text-[var(--color-text-muted)]">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-2">
            {users.map((user) => (
              <UserLabel
                key={user._id || user.name}
                user={user}
                size="xs"
                nameClassName="font-bold text-xs"
              />
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <PageLoadGuard loading={isLoading && !subscriptions.length} skeleton={PageSkeleton} className="!py-4">
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'count',
            label: 'Subscriptions',
            value: subscriptions.length,
            icon: CreditCard,
            variant: 'info',
          },
          {
            id: 'spend-monthly',
            label: 'Monthly Spend',
            value: formatInr(totalMonthlyInr),
            icon: CreditCard,
            variant: 'mint',
            info: 'Normalized recurring spend per month (by periodicity). One-time charges excluded.',
          },
          {
            id: 'spend-yearly',
            label: 'Yearly Spend',
            value: formatInr(totalYearlyInr),
            icon: CreditCard,
            variant: 'apricot',
            info: 'Monthly spend × 12. One-time charges excluded.',
          },
        ],
      }}
      toolbar={
        <SearchInput
          placeholder="Search subscriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!w-44 shrink min-w-[9rem]"
        />
      }
      toolbarActions={
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} /> Add Subscription
        </Button>
      }
    >
      <DataTable
        columns={subscriptionColumns}
        data={filtered}
        onRowClick={openEdit}
        getRowId={(sub) => sub._id}
        isLoading={isLoading}
        emptyTitle="No subscriptions"
        emptyDescription="Add one to get started."
      />

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
          <MemberSelect
            label="Used By"
            value={formData.usedBy}
            onChange={(usedBy) => setFormData({ ...formData, usedBy })}
            placeholder="Select team members..."
            multi
          />
          <Input
            label="Notes"
            multiline
            rows={3}
            autoGrow
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
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete subscription?',
                    message: `Delete subscription "${editing.name}"?`,
                    confirmLabel: 'Delete',
                    type: 'danger',
                  });
                  if (ok) deleteMutation.mutate(editing._id);
                }}
              >
                <Trash2 size={14} /> Delete
              </Button>
            )}
          </div>
        </form>
      </NexusModal>
    </ListPageLayout>
    </PageLoadGuard>
  );
};

export default SubscriptionsPage;
