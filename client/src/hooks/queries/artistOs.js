import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const osKey = (artistId, segment) => ['artist-os', artistId, segment];

export const useArtistOsOverview = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'overview'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/overview`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsInquiries = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'inquiries'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/inquiries`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsGigs = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'gigs'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/gigs`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsFinance = (artistId, month, enabled = true) => useQuery({
  queryKey: osKey(artistId, `finance-${month || 'current'}`),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/finance`, { params: { month } })).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsCalendar = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'calendar'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/calendar`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsTimeline = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'timeline'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/timeline`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsScores = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'scores'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/analytics/scores`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsContracts = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'contracts'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/contracts`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsNotes = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'notes'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/notes`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsContent = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'content'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/content`)).data,
  enabled: !!artistId && enabled,
});

export const useArtistOsDocuments = (artistId, enabled = true) => useQuery({
  queryKey: osKey(artistId, 'documents'),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/os/documents`)).data,
  enabled: !!artistId && enabled,
});

function invalidateOs(queryClient, artistId) {
  queryClient.invalidateQueries({ queryKey: ['artist-os', artistId] });
}

export const useCreateArtistInquiry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, data }) => axios.post(`/api/artists/${artistId}/os/inquiries`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};

export const useUpdateArtistInquiry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, inquiryId, data }) => axios.patch(`/api/artists/${artistId}/os/inquiries/${inquiryId}`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};

export const useCreateArtistGig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, data }) => axios.post(`/api/artists/${artistId}/os/gigs`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};

export const useUpdateArtistGig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, gigId, data }) => axios.patch(`/api/artists/${artistId}/os/gigs/${gigId}`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};

export const useCreateArtistFinanceEntry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, data }) => axios.post(`/api/artists/${artistId}/os/finance`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};

export const useCreateArtistNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, data }) => axios.post(`/api/artists/${artistId}/os/notes`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};

export const useCreateArtistContract = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, data }) => axios.post(`/api/artists/${artistId}/os/contracts`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};

export const useCreateArtistContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, data }) => axios.post(`/api/artists/${artistId}/os/content`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};

export const useCreateArtistCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, data }) => axios.post(`/api/artists/${artistId}/os/calendar`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => invalidateOs(queryClient, artistId),
  });
};
