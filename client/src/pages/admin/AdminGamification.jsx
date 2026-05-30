import React, { useState, useEffect } from 'react';
import { Card, Button, PageHeader, PageContainer, PageSkeleton } from '../../components/ui';
import { Edit2, Save, X, AlertCircle, CheckCircle, RefreshCw, Trophy } from 'lucide-react';
import axios from 'axios';
import { useConfirm } from '../../contexts/ConfirmContext';

const AdminGamification = () => {
  const { confirm } = useConfirm();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/gamification-admin/config');
      setConfig(res.data);
      setMessage({ type: '', text: '' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (field, value) => {
    setEditingField(field);
    setEditValue(String(value));
  };

  const handleSave = async (field = editingField) => {
    if (!field) return;
    try {
      setSaving(true);
      const numValue = Number(editValue);

      if (isNaN(numValue) || numValue < 0) {
        setMessage({ type: 'error', text: 'Please enter a valid positive number' });
        return;
      }

      await axios.put('/api/gamification-admin/config', {
        [field]: numValue
      });

      setConfig(prev => ({
        ...prev,
        [field]: numValue
      }));

      setMessage({ type: 'success', text: `${field} updated successfully` });
      setEditingField(null);
      setEditValue('');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleRecalculateAllLevels = async () => {
    const ok = await confirm({
      title: 'Recalculate levels?',
      message: 'This will recalculate levels for all users with the new formula. Continue?',
      confirmLabel: 'Continue',
      type: 'warning',
    });
    if (!ok) return;
    try {
      setRecalculating(true);
      const res = await axios.post('/api/gamification-admin/recalculate-all-levels');
      setMessage({
        type: 'success',
        text: res.data.message || `Updated ${res.data.updatedUsers} of ${res.data.totalUsers} users`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to recalculate levels' });
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return <PageContainer><PageSkeleton /></PageContainer>;
  }

  const sections = [
    {
      title: 'Action XP Values',
      description: 'XP awarded for various user actions',
      fields: [
        { key: 'taskCompletion', label: 'Task Completion', description: 'XP for completing a task (set to 0 to disable)' },
        { key: 'dailyLog', label: 'Daily Log', description: 'XP awarded for each manual daily log entry' },
        { key: 'taskCreation', label: 'Task Creation', description: 'XP awarded when a new task is created' },
        { key: 'projectCreation', label: 'Project Creation', description: 'XP awarded when a new project is created' },
        { key: 'attendanceLog', label: 'Attendance Log', description: 'XP awarded for logging attendance' },
        { key: 'assetUpload', label: 'Asset Upload', description: 'XP awarded when uploading project assets' },
        { key: 'commentCreation', label: 'Comment Creation', description: 'XP awarded when creating a comment' },
        { key: 'leadCapture', label: 'Lead Capture', description: 'XP awarded when capturing a new lead' },
        { key: 'invoiceSubmission', label: 'Invoice Submission', description: 'XP awarded when submitting an invoice' }
      ]
    },
    {
      title: 'Mission & Level Settings',
      description: 'Configure mission rewards and level progression',
      fields: [
        { key: 'dailyMissionBaseReward', label: 'Daily Mission Base Reward', description: 'Base XP reward for completing daily missions' },
        { key: 'stepXp', label: 'XP Per Level', description: 'XP required to advance one level (goal XP rounded to nearest 100 multiple)' },
        { key: 'baseXp', label: 'Base XP for Level 1', description: 'Starting XP value for level 1 (legacy, not currently used)' }
      ]
    }
  ];

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Gamification Configuration"
        subtitle="Manage XP values and reward multipliers"
        icon={Trophy}
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

      <div className="space-y-5 w-full" style={{ maxWidth: '720px' }}>
        {sections.map((section, idx) => (
          <Card key={idx} className="w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-bg-border)]">
              <h3 className="text-base font-bold">{section.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)]">{section.description}</p>
            </div>

            <div className="divide-y divide-[var(--color-bg-border)]">
              {section.fields.map(({ key, label, description }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-6 px-5 py-4 hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
                  </div>

                  {editingField === key ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(key);
                          if (e.key === 'Escape') handleCancel();
                        }}
                        className="w-20 px-3 py-2 text-sm text-center rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <Button
                        onClick={() => handleSave(key)}
                        disabled={saving}
                        size="sm"
                        className="gap-1"
                      >
                        <Save size={14} />
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        aria-label="Cancel"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 text-base font-bold rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] text-[var(--color-text-primary)] tabular-nums">
                        {config?.[key] ?? 0}
                      </span>
                      <Button
                        onClick={() => handleEdit(key, config?.[key] ?? 0)}
                        variant="secondary"
                        size="sm"
                        className="gap-1"
                      >
                        <Edit2 size={14} />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}

        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h4 className="font-bold text-sm mb-2">ℹ️ How XP Works</h4>
          <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
            <li>• Users earn XP by completing various actions</li>
            <li>• Reaching level thresholds is based on XP Per Level</li>
            <li>• Daily missions provide bonus XP rewards</li>
            <li>• All changes take effect immediately</li>
          </ul>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <h4 className="font-bold text-sm mb-3">⚠️ Recalculate All User XP</h4>
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Rebuilds each user&apos;s total XP from activity history using the current Action XP values above, then syncs levels from XP Per Level. Use this after changing XP rates — it does not affect past audit log entries, only stored user totals.
          </p>
          <Button
            onClick={handleRecalculateAllLevels}
            disabled={recalculating}
            className="gap-2"
          >
            <RefreshCw size={16} />
            {recalculating ? 'Recalculating...' : 'Recalculate All User XP'}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
};

export default AdminGamification;
