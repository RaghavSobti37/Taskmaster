import React, { useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '../ui';

export default function ProjectBudgetQuickSet({ projectId, hasBudget, canEdit }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!canEdit || hasBudget) return null;

  const handleSave = async () => {
    const parsed = Number(String(amount).replace(/,/g, '').trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a valid INR budget');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await axios.post('/api/finance', {
        project: projectId,
        category: 'budget',
        status: 'verified',
        metadata: { amount: parsed, currency: 'INR' },
      });
      await queryClient.invalidateQueries({ queryKey: ['project-analytics', projectId] });
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not save budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-[var(--color-bg-border)] p-3 flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[160px]">
        <Input
          label="Set project budget (INR)"
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 500000"
        />
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save budget'}
      </Button>
      {error && <p className="w-full text-xs text-rose-400">{error}</p>}
    </div>
  );
}
