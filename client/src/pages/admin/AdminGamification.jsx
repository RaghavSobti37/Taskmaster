import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, PageHeader, PageContainer, PageSkeleton, Badge } from '../../components/ui';
import { Edit2, AlertCircle, CheckCircle, RefreshCw, Trophy, Shield, Users, Ban } from 'lucide-react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '../../contexts/confirmContext';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

const AdminGamification = () => {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(null);
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editOriginalValue, setEditOriginalValue] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [recalculating, setRecalculating] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/gamification-admin/rules');
      setConfig(res.data.config);
      setRules(res.data.rules);
      setMessage({ type: '', text: '' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to load gamification rules' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleEdit = useCallback((field, value) => {
    setEditingField(field);
    const str = String(value);
    setEditValue(str);
    setEditOriginalValue(str);
  }, []);

  const invalidateGamificationQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['gamification'] });
    queryClient.refetchQueries({ queryKey: ['gamification', 'leaderboard'] });
  }, [queryClient]);

  const handleSave = useCallback(async (field = editingField) => {
    if (!field) return;
    try {
      setSaving(true);
      const numValue = Number(editValue);
      if (Number.isNaN(numValue) || numValue < 0) {
        setMessage({ type: 'error', text: 'Enter a valid non-negative number' });
        return;
      }
      const res = await axios.put('/api/gamification-admin/config', { [field]: numValue });
      if (res.data?.config) {
        setConfig(res.data.config);
      } else {
        setConfig((prev) => ({ ...prev, [field]: numValue }));
      }
      invalidateGamificationQueries();
      const recalcMsg = res.data?.recalc?.message;
      setMessage({
        type: 'success',
        text: recalcMsg || `${field} updated`,
      });
      setEditingField(null);
      setEditValue('');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Update failed' });
    } finally {
      setSaving(false);
    }
  }, [editingField, editValue, invalidateGamificationQueries]);

  const handleCancel = useCallback(() => {
    setEditingField(null);
    setEditValue('');
    setEditOriginalValue('');
  }, []);

  const hasFieldEdits = !!editingField && editValue !== editOriginalValue;

  useUnsavedChanges({
    hasChanges: hasFieldEdits,
    onSave: () => handleSave(),
    onCancel: handleCancel,
    isSaving: saving,
    enabled: false,
  });

  const handleRecalculateAllLevels = useCallback(async () => {
    const ok = await confirm({
      title: 'Recalculate all user XP?',
      message: 'Rebuilds totals from activity history using current XP rates, then syncs levels.',
      confirmLabel: 'Recalculate',
      type: 'warning',
    });
    if (!ok) return;
    try {
      setRecalculating(true);
      const res = await axios.post('/api/gamification-admin/recalculate-all-levels');
      invalidateGamificationQueries();
      setMessage({ type: 'success', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Recalculate failed' });
    } finally {
      setRecalculating(false);
    }
  }, [confirm, invalidateGamificationQueries]);

  const xpRuleRows = useMemo(() => {
    if (!rules?.xpRules || !config) return [];
    return rules.xpRules.map((row) => {
      const cap = rules.dailyCaps?.[row.capKey];
      const capLabel = cap == null ? 'Unlimited' : cap === 0 ? 'Disabled' : `${cap}/day`;
      return { ...row, xp: config[row.configKey] ?? 0, capLabel };
    });
  }, [rules, config]);

  const editableFields = useMemo(() => ([
    { key: 'stepXp', label: 'XP per level', description: 'Total XP needed to advance one level (linear: level = floor(exp / stepXp) + 1)' },
    { key: 'dailyMissionBaseReward', label: 'Mission scale reference', description: 'Reference value; individual missions use fixed bonuses (25 / 20 / 15)' },
  ]), []);

  if (loading) {
    return <PageContainer><PageSkeleton /></PageContainer>;
  }

  return (
    <PageContainer className="space-y-5 max-w-4xl">
      <PageHeader
        title="Gamification Rules"
        icon={Trophy}
        actions={(
          <Button
            onClick={handleRecalculateAllLevels}
            disabled={recalculating}
            className="gap-2 shrink-0"
            title="Rebuild audit log amounts, user totals, levels, and weekly leaderboard from current rates"
          >
            <RefreshCw size={16} className={recalculating ? 'animate-spin' : ''} />
            {recalculating ? 'Recalculating…' : 'Recalculate all user XP'}
          </Button>
        )}
      />

      {message.text && (
        <div className={`p-4 rounded-lg border flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={18} className="text-green-500 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-500 shrink-0" />
          )}
          <span className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </span>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-bg-border)]">
          <h3 className="text-base font-bold">XP by action</h3>
          <p className="text-sm text-[var(--color-text-muted)]">Click Edit to change rates — time-based actions use hours × XP per hour</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50 text-left text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">XP</th>
                <th className="px-4 py-3">Daily cap</th>
                <th className="px-4 py-3 hidden md:table-cell">Who earns</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {xpRuleRows.map((row) => (
                <tr key={row.configKey} className="hover:bg-[var(--color-bg-secondary)]/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{row.note}</p>
                  </td>
                  <td className="px-4 py-3">
                    {editingField === row.configKey ? (
                      <input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(row.configKey);
                          if (e.key === 'Escape') handleCancel();
                        }}
                        className="w-16 px-2 py-1 text-center rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]"
                        autoFocus
                      />
                    ) : (
                      <span className="font-bold tabular-nums">{row.xp}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.capLabel === 'Unlimited' ? 'info' : 'neutral'}>{row.capLabel}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-muted)] text-xs">{row.who}</td>
                  <td className="px-4 py-3">
                    {editingField === row.configKey ? (
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
                          Cancel
                        </Button>
                        <Button size="sm" variant="success" onClick={() => handleSave(row.configKey)} disabled={saving || !hasFieldEdits}>
                          {saving ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => handleEdit(row.configKey, row.xp)} className="gap-1">
                        <Edit2 size={12} /> Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-bg-border)] flex items-center gap-2">
          <Shield size={18} className="text-blue-500" />
          <div>
            <h3 className="text-base font-bold">Fairness principles</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Why the system is balanced across roles</p>
          </div>
        </div>
        <ul className="px-5 py-4 space-y-2 text-sm text-[var(--color-text-primary)]">
          {(rules?.fairnessPrinciples || []).map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-[var(--color-action-primary)] shrink-0">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-bg-border)] flex items-center gap-2">
          <Users size={18} />
          <h3 className="text-base font-bold">Paths to the leaderboard</h3>
        </div>
        <div className="divide-y divide-[var(--color-bg-border)]">
          {(rules?.rolePaths || []).map((path) => (
            <div key={path.role} className="px-5 py-4">
              <p className="font-bold text-sm">{path.role}</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">{path.actions}</p>
              <p className="text-xs text-[var(--color-action-primary)] mt-1 font-medium">{path.weeklyPotential}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-bg-border)]">
          <h3 className="text-base font-bold">Daily mission bonuses</h3>
          <p className="text-sm text-[var(--color-text-muted)]">Extra XP on top of action XP — resets each day</p>
        </div>
        <div className="divide-y divide-[var(--color-bg-border)]">
          {(rules?.dailyMissions || []).map((m) => (
            <div key={m.title} className="px-5 py-3 flex justify-between gap-4 items-center">
              <div>
                <p className="font-medium text-sm">{m.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{m.description}</p>
              </div>
              <Badge variant="success">+{m.expReward} XP</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-bg-border)] flex items-center gap-2">
          <Ban size={18} className="text-[var(--color-text-muted)]" />
          <h3 className="text-base font-bold">Actions that do not grant XP</h3>
        </div>
        <ul className="px-5 py-4 space-y-1.5 text-sm text-[var(--color-text-muted)]">
          {(rules?.noXpActions || []).map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-bg-border)]">
          <h3 className="text-base font-bold">Level progression</h3>
        </div>
        <div className="divide-y divide-[var(--color-bg-border)]">
          {editableFields.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between gap-6 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{label}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
              </div>
              {editingField === key ? (
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min="1"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(key);
                      if (e.key === 'Escape') handleCancel();
                    }}
                    className="w-20 px-3 py-2 text-sm text-center rounded border border-[var(--color-bg-border)]"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="success" onClick={() => handleSave(key)} disabled={saving || !hasFieldEdits}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold tabular-nums px-3 py-1 rounded border border-[var(--color-bg-border)]">{config?.[key] ?? 0}</span>
                  <Button size="sm" variant="secondary" onClick={() => handleEdit(key, config?.[key] ?? 0)}>
                    <Edit2 size={14} />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-[var(--color-bg-secondary)]/40 text-xs text-[var(--color-text-muted)]">
          Example: at {config?.stepXp ?? 100} XP/level — Level 2 at {config?.stepXp ?? 100} XP, Level 3 at {(config?.stepXp ?? 100) * 2} XP. Leaderboard ranks by <strong className="text-[var(--color-text-primary)]">this week&apos;s</strong> audit log sum. After rate changes, use <strong className="text-[var(--color-text-primary)]">Recalculate all user XP</strong> (top right) to sync totals and leaderboard.
        </div>
      </Card>
    </PageContainer>
  );
};

export default AdminGamification;
