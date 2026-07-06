import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { slugifyOrgSlug } from '../../constants/orgCreateOptions';

export const orgSettingsQueryKey = (tenantId) => ['orgSettings', tenantId];

const fetchOrgSettings = async (tenantId) => {
  const { data } = await axios.get(`/api/tenants/${tenantId}/settings`, { withCredentials: true });
  return data?.tenant ?? data;
};

export const tenantToOrgSettingsForm = (tenant = {}) => ({
  name: tenant.name || '',
  slug: tenant.slug || '',
  slugLocked: Boolean(tenant.slug),
  logoUrl: tenant.branding?.logoUrl || tenant.logoUrl || null,
  industry: tenant.industry || '',
  teamSize: tenant.teamSize || '',
  timezone: tenant.settings?.timezone || 'Asia/Kolkata',
  currency: tenant.settings?.defaultCurrency || tenant.settings?.currency || 'INR',
  dateFormat: tenant.settings?.dateFormat || 'DD/MM/YYYY',
});

export const buildUpdateTenantPayload = (form) => {
  const payload = {
    name: String(form.name).trim(),
    industry: form.industry,
    teamSize: form.teamSize,
    settings: {
      timezone: form.timezone,
      defaultCurrency: form.currency,
      dateFormat: form.dateFormat,
    },
  };

  if (!form.slugLocked) {
    payload.slug = slugifyOrgSlug(form.slug || form.name);
  }

  if (form.logoUrl) {
    payload.logo = form.logoUrl;
  } else {
    payload.logo = null;
  }

  return payload;
};

export const useOrgSettings = (tenantId, enabled = true) => useQuery({
  queryKey: orgSettingsQueryKey(tenantId),
  queryFn: () => fetchOrgSettings(tenantId),
  enabled: Boolean(tenantId) && enabled,
  staleTime: 30_000,
});

export const useUpdateOrgSettings = (tenantId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (form) => {
      const { data } = await axios.patch(
        `/api/tenants/${tenantId}/settings`,
        buildUpdateTenantPayload(form),
        { withCredentials: true },
      );
      return data?.tenant ?? data;
    },
    onSuccess: (tenant) => {
      queryClient.setQueryData(orgSettingsQueryKey(tenantId), tenant);
      queryClient.invalidateQueries({ queryKey: ['tenantMemberships'] });
    },
  });
};

export const useOffboardOrganization = () => useMutation({
  mutationFn: async () => {
    const { data } = await axios.post('/api/enterprise/offboard', {}, { withCredentials: true });
    return data;
  },
});
