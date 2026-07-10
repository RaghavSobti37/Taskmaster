import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Building2 } from 'lucide-react';
import { Button, Input, PageContainer, PageHeader, PageSkeleton } from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import QueryErrorSlot from '../../components/ui/QueryErrorSlot';
import { useToast } from '../../contexts/ToastContext';

export default function AdminTenantSsoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await axios.get('/api/admin/tenants');
      setTenants(res.data.tenants || []);
    } catch (err) {
      setLoadError(err);
      toast.error(err.response?.data?.error || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleSave = async (tenant) => {
    setSavingId(tenant._id);
    try {
      const res = await axios.patch(`/api/admin/tenants/${tenant._id}`, {
        clerkOrganizationId: tenant.clerkOrganizationId || '',
        allowedEmailDomain: tenant.allowedEmailDomain || '',
        status: tenant.status,
      });
      setTenants((prev) => prev.map((t) => (t._id === tenant._id ? res.data.tenant : t)));
      toast.success('Tenant SSO settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const updateField = (id, field, value) => {
    setTenants((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: value } : t)));
  };

  if (loading) return <PageSkeleton />;

  return (
    <PageContainer>
      <PageHeader
        title="Tenant SSO"
        subtitle="Link Clerk organizations to CoreKnot tenants for enterprise SAML/OIDC"
        icon={Building2}
        backTo={ADMIN_CONSOLE_PATH}
      />
      {loadError ? (
        <QueryErrorSlot error={loadError} onRetry={loadTenants} />
      ) : (
        <div className="space-y-4">
          {tenants.map((tenant) => (
            <div
              key={tenant._id}
              className="p-4 rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)]"
            >
              <p className="font-semibold text-[var(--color-text-primary)]">{tenant.name}</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">{tenant.slug || tenant._id}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs">
                  Clerk organization ID
                  <Input
                    value={tenant.clerkOrganizationId || ''}
                    onChange={(e) => updateField(tenant._id, 'clerkOrganizationId', e.target.value)}
                    placeholder="org_..."
                    className="mt-1"
                  />
                </label>
                <label className="text-xs">
                  Allowed email domain
                  <Input
                    value={tenant.allowedEmailDomain || ''}
                    onChange={(e) => updateField(tenant._id, 'allowedEmailDomain', e.target.value)}
                    placeholder="company.com"
                    className="mt-1"
                  />
                </label>
              </div>
              <Button
                className="mt-3"
                size="sm"
                disabled={savingId === tenant._id}
                onClick={() => handleSave(tenant)}
              >
                Save
              </Button>
            </div>
          ))}
          {!tenants.length && (
            <p className="text-sm text-[var(--color-text-secondary)]">No tenants configured.</p>
          )}
        </div>
      )}
    </PageContainer>
  );
}
