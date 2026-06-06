import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const newsletterKeys = {
  all: ['newsletter'],
  current: () => [...newsletterKeys.all, 'current'],
  issue: (weekKey) => [...newsletterKeys.all, 'issue', weekKey],
  categories: () => [...newsletterKeys.all, 'categories'],
  preview: (issueId) => [...newsletterKeys.all, 'preview', issueId],
};

export const useNewsletterCategories = () => useQuery({
  queryKey: newsletterKeys.categories(),
  queryFn: async () => (await axios.get('/api/newsletter/categories')).data,
  staleTime: 1000 * 60 * 60,
});

export const useCurrentNewsletterIssue = () => useQuery({
  queryKey: newsletterKeys.current(),
  queryFn: async () => (await axios.get('/api/newsletter/issues/current')).data,
  staleTime: 1000 * 30,
});

export const useNewsletterIssue = (weekKey, enabled = true) => useQuery({
  queryKey: newsletterKeys.issue(weekKey),
  queryFn: async () => (await axios.get(`/api/newsletter/issues/${weekKey}`)).data,
  enabled: enabled && !!weekKey,
  staleTime: 1000 * 30,
});

export const usePreviewNewsletterLink = () => useMutation({
  mutationFn: (url) => axios.post('/api/newsletter/links/preview', { url }).then((r) => r.data),
});

export const useCreateNewsletterArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/newsletter/articles', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all });
    },
  });
};

export const useUpdateNewsletterArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => axios.patch(`/api/newsletter/articles/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all });
    },
  });
};

export const useDeleteNewsletterArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/newsletter/articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all });
    },
  });
};

export const useCurateNewsletterIssue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, ...payload }) => axios.patch(`/api/newsletter/issues/${issueId}/curate`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all });
    },
  });
};

export const useCompileNewsletterIssue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issueId) => axios.post(`/api/newsletter/issues/${issueId}/compile`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all });
    },
  });
};

export const useNewsletterHtmlPreview = (issueId, enabled = true) => useQuery({
  queryKey: newsletterKeys.preview(issueId),
  queryFn: async () => (await axios.get(`/api/newsletter/issues/${issueId}/preview`)).data,
  enabled: enabled && !!issueId,
});

export const useNewsletterAudiencePreview = () => useMutation({
  mutationFn: ({ issueId, audience, excludedEmails }) => axios
    .post(`/api/newsletter/issues/${issueId}/audience-preview`, { audience, excludedEmails })
    .then((r) => r.data),
});

export const useSendNewsletterIssue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, ...payload }) => axios.post(`/api/newsletter/issues/${issueId}/send`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.all });
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
    },
  });
};
