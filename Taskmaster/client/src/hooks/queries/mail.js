import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { normalizeEmailStreams } from '../../constants/resendFromEmails';
import { buildAutoMailerUrl } from '../../utils/autoMailerUrl';
import useTenantQueryKey from '../useTenantQueryKey';

const movedToAutoMailer = (path = '/emails') => ({
  moved: true,
  service: 'auto-mailer',
  url: buildAutoMailerUrl(path),
  message: 'Email workflows moved to Auto-Mailer',
});

const useMovedQuery = (queryKey, path, options = {}) => useQuery({
  queryKey,
  queryFn: async () => movedToAutoMailer(path),
  enabled: options.enabled ?? true,
  staleTime: Infinity,
});

const useMovedMutation = (path) => useMutation({
  mutationFn: async () => movedToAutoMailer(path),
});

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

export const useMailCampaigns = (enabled = true) =>
  useMovedQuery(useTenantQueryKey('mail', 'campaigns'), '/emails/campaigns', { enabled });

export const useCampaignDetails = (id) =>
  useMovedQuery(useTenantQueryKey('campaign', id), id ? `/campaign/${id}` : '/emails/campaigns', { enabled: !!id });

export const useCampaignAnalytics = (id, { enabled = true } = {}) =>
  useMovedQuery(useTenantQueryKey('campaign', id, 'analytics'), id ? `/campaign/${id}` : '/emails/campaigns', {
    enabled: !!id && enabled,
  });

export const useCampaignRecipients = (id, { enabled = true } = {}) =>
  useMovedQuery(useTenantQueryKey('campaign', id, 'recipients'), id ? `/campaign/${id}` : '/emails/campaigns', {
    enabled: !!id && enabled,
  });

export const useMailProfiles = (enabled = true) =>
  useMovedQuery(useTenantQueryKey('mail', 'profiles'), '/emails/profiles', { enabled });

export const useCreateMailProfile = () => useMovedMutation('/emails/profiles');
export const useDeleteMailProfile = () => useMovedMutation('/emails/profiles');
export const useUpdateMailProfile = () => useMovedMutation('/emails/profiles');
export const useCreateCampaign = () => useMovedMutation('/emails/create');
export const useUploadCampaignAttachment = () => useMovedMutation('/emails/create');
export const useSendCampaign = () => useMovedMutation('/emails/campaigns');
export const useStopCampaign = () => useMovedMutation('/emails/campaigns');
export const useResendCampaign = () => useMovedMutation('/emails/campaigns');
export const useResendFilteredCampaign = () => useMovedMutation('/emails/campaigns');
export const useDeleteCampaign = () => useMovedMutation('/emails/campaigns');
export const useScanBounces = () => useMovedMutation('/emails/campaigns');

export const useMailTemplates = (status = null, enabled = true) =>
  useMovedQuery(['mail', 'templates', status || 'all'], '/emails/templates', { enabled });

export const usePendingMailTemplates = (enabled = true) =>
  useMovedQuery(['mail', 'templates', 'pending'], '/emails/templates', { enabled });

export const useSaveMailTemplate = () => useMovedMutation('/emails/templates');
export const useSubmitMailTemplate = () => useMovedMutation('/emails/templates');
export const useApproveMailTemplate = () => useMovedMutation('/emails/templates');
export const useRejectMailTemplate = () => useMovedMutation('/emails/templates');
export const useDeleteMailTemplate = () => useMovedMutation('/emails/templates');

export const fetchMailTemplateById = async () => movedToAutoMailer('/emails/templates');

export const patchMailTemplateInCaches = () => {};

export const useRefreshMailTemplate = () => useMovedMutation('/emails/templates');
export const useCampaignExlyOfferings = (options = {}) =>
  useMovedQuery(['mail', 'audience', 'exly', 'offerings'], '/emails/create', { enabled: options.enabled !== false });
export const useCampaignExlyAudience = (_params = {}, options = {}) =>
  useMovedQuery(['mail', 'audience', 'exly'], '/emails/create', { enabled: options.enabled ?? false });
export const useCampaignDataHubFolders = (options = {}) =>
  useMovedQuery(['mail', 'audience', 'data-hub', 'folders'], '/emails/create', { enabled: options.enabled !== false });
export const useCampaignDataHubAudience = (_params = {}, options = {}) =>
  useMovedQuery(['mail', 'audience', 'data-hub'], '/emails/create', { enabled: options.enabled ?? false });

export const useEmailStreams = (enabled = true) => useQuery({
  queryKey: ['mail', 'streams'],
  queryFn: async () => normalizeEmailStreams([]),
  enabled,
  staleTime: Infinity,
});

export const usePublicEmailStreams = (enabled = true) => useQuery({
  queryKey: ['mail', 'streams', 'public'],
  queryFn: async () => normalizeEmailStreams([]),
  enabled,
  staleTime: 1000 * 60 * 30,
});
