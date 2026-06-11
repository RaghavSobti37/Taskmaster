import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';

export const useMailStats = (enabled = true, options = {}) => useQuery({
  queryKey: ['mail', 'stats'],
  queryFn: async () => (await axios.get('/api/mail/stats')).data,
  enabled,
  staleTime: options.staleTime ?? 1000 * 60 * 5,
  refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
  refetchOnMount: options.refetchOnMount,
});

export const useMailCampaigns = (enabled = true) => useQuery({
  queryKey: ['mail', 'campaigns'],
  queryFn: async () => (await axios.get('/api/campaigns')).data,
  enabled,
  staleTime: 1000 * 60 * 2,
});

export const useCampaignDetails = (id) => useQuery({
  queryKey: ['campaign', id],
  queryFn: async () => (await axios.get(`/api/campaigns/${id}`)).data,
  enabled: !!id,
  staleTime: 1000 * 30,
});

export const useCampaignRecipients = (id, { page = 1, limit = 25, status = 'all', hideInvalid = false, enabled = true } = {}) => useQuery({
  queryKey: ['campaign', id, 'recipients', page, limit, status, hideInvalid],
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

export const useCumulativeAnalytics = (enabled = true) => useQuery({
  queryKey: ['analytics', 'cumulative'],
  queryFn: async () => (await axios.get('/api/analytics/cumulative')).data,
  enabled,
  staleTime: 1000 * 60,
});

export const useMailProfiles = (enabled = true) => useQuery({
  queryKey: ['mail', 'profiles'],
  queryFn: async () => (await axios.get('/api/mail/profiles')).data,
  enabled,
  staleTime: 1000 * 60 * 10,
});

export const useLocationLeads = (location, enabled = false) => useQuery({
  queryKey: ['leads', 'location', location],
  queryFn: async () => {
    const { data } = await axios.get('/api/analytics/location-leads', { params: { location } });
    return data?.data ?? data;
  },
  enabled: enabled && !!location,
});

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
