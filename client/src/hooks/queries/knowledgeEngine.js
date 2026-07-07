import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import useTenantQueryKey from '../useTenantQueryKey';

const BASE = '/api/knowledge-engine';

export const useKnowledgeDashboard = (options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'dashboard'],
  queryFn: async () => (await axios.get(`${BASE}/dashboard`)).data,
  staleTime: 1000 * 30,
  ...options,
});

export const useKnowledgeArticles = (params = {}, options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'articles', params],
  queryFn: async () => (await axios.get(`${BASE}/articles`, { params })).data,
  placeholderData: keepPreviousData,
  ...options,
});

export const useKnowledgeArticle = (id, options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'article', id],
  queryFn: async () => (await axios.get(`${BASE}/articles/${id}`)).data,
  enabled: !!id,
  ...options,
});

export const useKnowledgeChunks = (params = {}, options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'knowledge', params],
  queryFn: async () => (await axios.get(`${BASE}/knowledge`, { params })).data,
  placeholderData: keepPreviousData,
  ...options,
});

export const useKnowledgeCalendar = (params = {}, options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'calendar', params],
  queryFn: async () => (await axios.get(`${BASE}/calendar`, { params })).data,
  ...options,
});

export const useKnowledgeKeywords = (params = {}, options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'keywords', params],
  queryFn: async () => (await axios.get(`${BASE}/keywords`, { params })).data,
  ...options,
});

export const useKnowledgeOpportunities = (params = {}, options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'opportunities', params],
  queryFn: async () => (await axios.get(`${BASE}/opportunities`, { params })).data,
  ...options,
});

export const useKnowledgeBriefs = (params = {}, options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'briefs', params],
  queryFn: async () => (await axios.get(`${BASE}/briefs`, { params })).data,
  ...options,
});

export const useKnowledgeConnections = (options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'connections'],
  queryFn: async () => (await axios.get(`${BASE}/connections`)).data,
  ...options,
});

export const useKnowledgeSources = (options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'sources'],
  queryFn: async () => (await axios.get(`${BASE}/sources`)).data,
  ...options,
});

export const useKnowledgeDistribution = (articleId, options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'distribution', articleId],
  queryFn: async () => (await axios.get(`${BASE}/distribution`, { params: articleId ? { articleId } : {} })).data,
  ...options,
});

export const useKnowledgeOutreach = (options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'outreach'],
  queryFn: async () => (await axios.get(`${BASE}/outreach`)).data,
  ...options,
});

export const useKnowledgeAnalytics = (options = {}) => {
  const queryKey = useTenantQueryKey('knowledgeEngine', 'analytics');
  return useQuery({
    queryKey,
    queryFn: async () => (await axios.get(`${BASE}/analytics`)).data,
    ...options,
  });
};

export const useKnowledgeSettings = (options = {}) => useQuery({
  queryKey: ['knowledgeEngine', 'settings'],
  queryFn: async () => (await axios.get(`${BASE}/settings`)).data,
  ...options,
});

function invalidateAll(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['knowledgeEngine'] });
}

export const useUpdateKnowledgeArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => axios.patch(`${BASE}/articles/${id}`, body).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useCreateKnowledgeArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => axios.post(`${BASE}/articles`, body).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useApproveKnowledgeArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`${BASE}/articles/${id}/approve`).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const usePublishKnowledgeArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`${BASE}/articles/${id}/publish`).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useKnowledgeJobTrigger = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (job) => axios.post(`${BASE}/jobs/trigger`, { job }).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useGenerateBrief = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (opportunityId) => axios.post(`${BASE}/opportunities/${opportunityId}/brief`).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useRunArticlePipeline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => axios.post(`${BASE}/pipeline/article`, body).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useMediumPrep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`${BASE}/articles/${id}/medium-prep`).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useSetMediumUrl = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mediumUrl }) => axios.patch(`${BASE}/articles/${id}/medium-url`, { mediumUrl }).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useUpdateKnowledgeSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => axios.patch(`${BASE}/settings`, body).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useUpsertCalendar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => axios.post(`${BASE}/calendar`, body).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};

export const useCreateDistribution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`${BASE}/articles/${id}/distribution`).then((r) => r.data),
    onSuccess: () => invalidateAll(queryClient),
  });
};
