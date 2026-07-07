import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import useTenantQueryKey from '../useTenantQueryKey';

export const useMailStats = (enabled = true, options = {}) => {
  const timeframe = options.timeframe;
  const queryKey = useTenantQueryKey('mail', 'stats', timeframe ?? 'all');
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = timeframe ? { timeframe } : {};
      return (await axios.get('/api/mail/stats', { params })).data;
    },
    enabled,
    staleTime: options.staleTime ?? 1000 * 60 * 5,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
    refetchOnMount: options.refetchOnMount,
  });
};

export const useMailCampaigns = (enabled = true) => {
  const queryKey = useTenantQueryKey('mail', 'campaigns');
  return useQuery({
    queryKey,
  queryFn: async () => (await axios.get('/api/campaigns')).data,
  enabled,
  staleTime: 1000 * 60 * 2,
  });
};

export const useCampaignDetails = (id) => {
  const queryKey = useTenantQueryKey('campaign', id);
  return useQuery({
    queryKey,
  queryFn: async () => (await axios.get(`/api/campaigns/${id}`)).data,
  enabled: !!id,
  staleTime: 1000 * 30,
  });
};

export const useCampaignAnalytics = (id, { enabled = true } = {}) => {
  const queryKey = useTenantQueryKey('campaign', id, 'analytics');
  return useQuery({
    queryKey,
  queryFn: async () => (await axios.get(`/api/campaigns/${id}/analytics`)).data,
  enabled: !!id && enabled,
  staleTime: 1000 * 60,
  });
};

export const useCampaignRecipients = (id, { page = 1, limit = 25, status = 'all', hideInvalid = false, enabled = true } = {}) => {
  const queryKey = useTenantQueryKey('campaign', id, 'recipients', page, limit, status, hideInvalid);
  return useQuery({
    queryKey,
  queryFn: async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      status,
      hideInvalid: hideInvalid ? 'true' : 'false',
    });
    const { data } = await axios.get(`/api/campaigns/${id}/recipients?${params}`);
    return data;
  },
  enabled: !!id && enabled,
  staleTime: 1000 * 15,
  placeholderData: keepPreviousData,
  });
};

export const useCumulativeAnalytics = (enabled = true) => {
  const queryKey = useTenantQueryKey('analytics', 'cumulative');
  return useQuery({
    queryKey,
  queryFn: async () => (await axios.get('/api/analytics/cumulative')).data,
  enabled,
  staleTime: 1000 * 60,
  });
};

export const useMailProfiles = (enabled = true) => {
  const queryKey = useTenantQueryKey('mail', 'profiles');
  return useQuery({
    queryKey,
  queryFn: async () => (await axios.get('/api/mail/profiles')).data,
  enabled,
  staleTime: 1000 * 60 * 10,
  });
};

export const useLocationLeads = (location, enabled = false) => {
  const queryKey = useTenantQueryKey('leads', 'location', location);
  return useQuery({
    queryKey,
  queryFn: async () => {
    const { data } = await axios.get('/api/analytics/location-leads', { params: { location } });
    return data?.data ?? data;
  },
  enabled: enabled && !!location,
  });
};

export const useCreateMailProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/mail/profiles', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] }),
  });
};

export const useDeleteMailProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/mail/profiles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] }),
  });
};

export const useUpdateMailProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => axios.put(`/api/mail/profiles/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] }),
  });
};

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/campaigns', data),
    onSuccess: (response) => {
      const campaign = response?.data ?? response;
      const id = campaign?.campaignId || campaign?._id;
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['campaign', id] });
        queryClient.invalidateQueries({ queryKey: ['campaign', id, 'analytics'] });
      }
    },
  });
};

export const useUploadCampaignAttachment = () => useMutation({
  mutationFn: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await axios.post('/api/campaigns/upload-attachment', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
});

export const useSendCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/campaigns/${id}/dispatch`),
    onSuccess: (_response, id) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id, 'analytics'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id, 'recipients'] });
    },
  });
};

export const useStopCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/campaigns/${id}/stop`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id, 'analytics'] });
    },
  });
};

export const useResendCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => axios.post(`/api/campaigns/${id}/resend`, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id, 'analytics'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] });
    },
  });
};

export const useResendFilteredCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => axios.post(`/api/campaigns/${id}/resend-filtered`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'cumulative'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] });
    },
  });
};

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'cumulative'] });
    },
  });
};

export const useScanBounces = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId) => axios.post('/api/mail/scan-bounces', { profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
    },
  });
};

const useSyncUnsubscribed = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.post('/api/crm/sync-unsubscribed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
};

export const useMailTemplates = (status = null, enabled = true) => useQuery({
  queryKey: ['mail', 'templates', status || 'all'],
  queryFn: async () => {
    const params = status ? { status } : {};
    return (await axios.get('/api/mail/templates', { params })).data;
  },
  enabled,
  staleTime: 1000 * 60 * 5,
});

export const usePendingMailTemplates = (enabled = true) => useQuery({
  queryKey: ['mail', 'templates', 'pending'],
  queryFn: async () => (await axios.get('/api/mail/templates/pending')).data,
  enabled,
  staleTime: 1000 * 30,
});

export const useSaveMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/mail/templates', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] }),
  });
};

export const useSubmitMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/mail/templates/${id}/submit`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] }),
  });
};

export const useApproveMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content, subject }) => axios.post(`/api/mail/templates/${id}/approve`, { content, subject }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] }),
  });
};

export const useRejectMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionNote }) => axios.post(`/api/mail/templates/${id}/reject`, { rejectionNote }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] }),
  });
};

export const useDeleteMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/mail/templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] }),
  });
};

export const fetchMailTemplateById = async (id) => {
  return (await axios.get(`/api/mail/templates/${id}`)).data;
};

/** Patch a single template into every cached templates list (all + status filters). */
export const patchMailTemplateInCaches = (queryClient, updated) => {
  if (!updated?._id) return;
  const statusKeys = ['all', 'approved', 'draft', 'pending_approval', 'rejected', 'pending'];
  for (const statusKey of statusKeys) {
    queryClient.setQueryData(['mail', 'templates', statusKey], (old) => {
      if (!Array.isArray(old)) return old;
      const idx = old.findIndex((t) => String(t._id) === String(updated._id));
      if (idx === -1) return old;
      const next = [...old];
      next[idx] = { ...next[idx], ...updated };
      return next;
    });
  }
};

export const useRefreshMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fetchMailTemplateById,
    onSuccess: (data) => {
      patchMailTemplateInCaches(queryClient, data);
      queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] });
    },
  });
};

export const useCampaignExlyOfferings = (options = {}) => useQuery({
  queryKey: ['mail', 'audience', 'exly', 'offerings'],
  queryFn: async () => (await axios.get('/api/mail/audience/exly/offerings')).data,
  enabled: options.enabled !== false,
  staleTime: 1000 * 60 * 10,
});

export const useCampaignExlyAudience = (params = {}, options = {}) => useQuery({
  queryKey: ['mail', 'audience', 'exly', params],
  queryFn: async () => (await axios.get('/api/mail/audience/exly', { params })).data,
  enabled: options.enabled ?? false,
  staleTime: 1000 * 60 * 2,
  placeholderData: keepPreviousData,
});

export const useCampaignDataHubFolders = (options = {}) => useQuery({
  queryKey: ['mail', 'audience', 'data-hub', 'folders'],
  queryFn: async () => (await axios.get('/api/mail/audience/data-hub/folders')).data,
  enabled: options.enabled !== false,
  staleTime: 1000 * 60 * 10,
});

export const useCampaignDataHubAudience = (params = {}, options = {}) => useQuery({
  queryKey: ['mail', 'audience', 'data-hub', params],
  queryFn: async () => (await axios.get('/api/mail/audience/data-hub', { params })).data,
  enabled: options.enabled ?? false,
  staleTime: 1000 * 60 * 2,
  placeholderData: keepPreviousData,
});

export const useEmailStreams = (enabled = true) => useQuery({
  queryKey: ['mail', 'streams'],
  queryFn: async () => (await axios.get('/api/mail/streams')).data,
  enabled,
  staleTime: 1000 * 60 * 10,
});

export const usePublicEmailStreams = (enabled = true) => useQuery({
  queryKey: ['mail', 'streams', 'public'],
  queryFn: async () => (await axios.get('/api/track/email-streams')).data,
  enabled,
  staleTime: 1000 * 60 * 30,
});
