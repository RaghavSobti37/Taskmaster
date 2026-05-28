import React, { useState, useEffect } from 'react';
import { Card, Button, Input, PageHeader, PageContainer, Badge } from '../../components/ui';
import { Edit2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';

const AdminGamification = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

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

  const handleSave = async () => {
    try {
      setSaving(true);
      const numValue = Number(editValue);

      if (isNaN(numValue) || numValue < 0) {
        setMessage({ type: 'error', text: 'Please enter a valid positive number' });
        return;
      }

      await axios.put('/api/gamification-admin/config', {
        [editingField]: numValue
      });

      setConfig(prev => ({
        ...prev,
        [editingField]: numValue
      }));

      setMessage({ type: 'success', text: `${editingField} updated successfully` });
      setEditingField(null);
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

  if (loading) {
    return <PageContainer><div className="text-center py-12">Loading...</div></PageContainer>;
  }

  const sections = [
    {
      title: 'Action XP Values',
      description: 'XP awarded for various user actions',
      fields: [
        { key: 'taskCompletion', label: 'Task Completion' },
        { key: 'taskCreation', label: 'Task Creation' },
        { key: 'projectCreation', label: 'Project Creation' },
        { key: 'attendanceLog', label: 'Attendance Log' },
        { key: 'assetUpload', label: 'Asset Upload' },
        { key: 'commentCreation', label: 'Comment Creation' },
        { key: 'leadCapture', label: 'Lead Capture' },
        { key: 'invoiceSubmission', label: 'Invoice Submission' }
      ]
    },
    {
      title: 'Mission & Level Settings',
      description: 'Configure mission rewards and level progression',
      fields: [
        { key: 'dailyMissionBaseReward', label: 'Daily Mission Base Reward' },
        { key: 'stepXp', label: 'XP Per Level' },
        { key: 'baseXp', label: 'Base XP for Level 1' }
      ]
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Gamification Configuration"
        description="Manage XP values and reward multipliers"
      />

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg border flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={18} className="text-green-500" />
          ) : (
            <AlertCircle size={18} className="text-red-500" />
          )}
          <span className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </span>
        </div>
      )}

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <Card key={idx}>
            <div className="p-6 border-b border-[var(--color-bg-border)]">
              <h3 className="text-lg font-bold">{section.title}</h3>
              <p className="text-sm text-[var(--color-text-muted)]">{section.description}</p>
            </div>

            <div className="divide-y divide-[var(--color-bg-border)]">
              {section.fields.map(({ key, label }) => (
                <div key={key} className="p-6 flex items-center justify-between hover:bg-[var(--color-bg-secondary)] transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-[var(--color-text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Key: {key}</p>
                  </div>

                  {editingField === key ? (
                    <div className="flex items-center gap-2 w-40">
                      <Input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1"
                        autoFocus
                      />
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        size="sm"
                        className="gap-1"
                      >
                        <Save size={14} />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        size="sm"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="px-3 py-1 text-base font-bold">
                        {config?.[key] || 0}
                      </Badge>
                      <Button
                        onClick={() => handleEdit(key, config?.[key] || 0)}
                        variant="outline"
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
      </div>

      <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <h4 className="font-bold text-sm mb-2">ℹ️ How XP Works</h4>
        <ul className="text-sm text-[var(--color-text-muted)] space-y-1">
          <li>• Users earn XP by completing various actions</li>
          <li>• Reaching level thresholds is based on XP Per Level</li>
          <li>• Daily missions provide bonus XP rewards</li>
          <li>• All changes take effect immediately</li>
        </ul>
      </div>
    </PageContainer>
  );
};

export default AdminGamification;
