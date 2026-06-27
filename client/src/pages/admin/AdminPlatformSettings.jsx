import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { Button, PageContainer, PageHeader, PageSkeleton } from '../../components/ui';
import PlatformSettingsUserField from '../../components/admin/PlatformSettingsUserField';
import { useUserDirectory } from '../../hooks/useTaskmasterQueries';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import { useToast } from '../../contexts/ToastContext';
import { stableJsonEqual } from '../../hooks/useUnsavedChanges';

const toPayload = (settings, fields) => {
  const payload = {};
  for (const field of fields) {
    const raw = settings?.[field.key];
    if (field.multiple) {
      payload[field.key] = (raw || []).map((u) => u?._id).filter(Boolean);
    } else {
      payload[field.key] = raw?._id || null;
    }
  }
  return payload;
};

const AdminPlatformSettings = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const deferUsers = useDeferredQueryEnabled(!loading);
  const { data: users = [], isLoading: usersLoading } = useUserDirectory(deferUsers);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState([]);
  const [sections, setSections] = useState([]);
  const [settings, setSettings] = useState(null);
  const [baseline, setBaseline] = useState(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/platform-settings');
      setFields(res.data.fields || []);
      setSections(res.data.sections || []);
      setSettings(res.data.settings);
      setBaseline(res.data.settings);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const hasChanges = useMemo(
    () => !!baseline && !!settings && !stableJsonEqual(
      toPayload(settings, fields),
      toPayload(baseline, fields)
    ),
    [baseline, settings, fields]
  );

  const handleFieldChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!settings || !fields.length) return;
    setSaving(true);
    try {
      const res = await axios.put('/api/admin/platform-settings', toPayload(settings, fields));
      setSettings(res.data.settings);
      setBaseline(res.data.settings);
      await queryClient.invalidateQueries({ queryKey: ['platform-exclusions'] });
      toast.success('Platform settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save platform settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    if (baseline) setSettings(baseline);
  };

  if (loading || usersLoading) return <PageSkeleton />;

  return (
    <PageContainer>
      <PageHeader
        title="Platform settings"
        subtitle="Assign users for system emails, alerts, CRM routing, and protected roles — no env edits needed."
        icon={Settings2}
        actions={(
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasChanges || saving}
              onClick={handleRevert}
            >
              Revert
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!hasChanges || saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      />

      <div className="space-y-10 mt-6">
        {sections.map((section) => {
          const sectionFields = fields.filter((f) => f.section === section.id);
          if (!sectionFields.length) return null;
          return (
            <section key={section.id} className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
                {section.label}
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {sectionFields.map((field) => (
                  <PlatformSettingsUserField
                    key={field.key}
                    field={field}
                    users={users}
                    value={settings?.[field.key]}
                    onChange={(value) => handleFieldChange(field.key, value)}
                    disabled={saving}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
};

export default AdminPlatformSettings;
