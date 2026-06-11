import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { isUserOnArtistTeam } from '../../utils/artistTeamAccess';
import { buildFallbackMembership } from '../../utils/artistMemberPermissions';

const membersKey = (artistId) => ['artist-memberships', artistId];
const membershipKey = (artistId, userId) => ['artist-membership', artistId, userId];

async function fetchMembershipWithFallback(artistId, user) {
  try {
    const data = (await axios.get(`/api/artists/${artistId}/membership/me`)).data;
    if (data) return data;
  } catch (err) {
    const status = err.response?.status;
    if (status !== 404 && status !== 501 && status !== 403) throw err;
  }

  const artist = (await axios.get(`/api/artists/${artistId}`)).data;
  if (isUserOnArtistTeam(user, artist?.team)) {
    return buildFallbackMembership(user, artist);
  }
  return null;
}

export const useArtistMembership = (artistId, enabled = true) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: membershipKey(artistId, user?._id),
    queryFn: () => fetchMembershipWithFallback(artistId, user),
    enabled: !!artistId && !!user && enabled,
    staleTime: 1000 * 60 * 2,
    retry: (count, err) => {
      const status = err.response?.status;
      if (status === 404 || status === 403) return false;
      return count < 1;
    },
  });
};

export const useArtistMemberships = (artistId, enabled = true) => useQuery({
  queryKey: membersKey(artistId),
  queryFn: async () => (await axios.get(`/api/artists/${artistId}/members`)).data,
  enabled: !!artistId && enabled,
  staleTime: 1000 * 60 * 2,
});

/** @deprecated use useArtistMemberships */
export const useArtistMembers = useArtistMemberships;

export const useInviteArtistMembership = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, data }) =>
      axios.post(`/api/artists/${artistId}/members/invite`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => {
      queryClient.invalidateQueries({ queryKey: membersKey(artistId) });
      queryClient.invalidateQueries({ queryKey: ['artist-membership', artistId] });
    },
  });
};

/** @deprecated use useInviteArtistMembership */
export const useInviteArtistMember = useInviteArtistMembership;

export const useUpdateArtistMembership = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, membershipId, data }) =>
      axios.patch(`/api/artists/${artistId}/members/${membershipId}`, data).then((r) => r.data),
    onSuccess: (_d, { artistId }) => {
      queryClient.invalidateQueries({ queryKey: membersKey(artistId) });
      queryClient.invalidateQueries({ queryKey: ['artist-membership', artistId] });
    },
  });
};

/** @deprecated use useUpdateArtistMembership */
export const useUpdateArtistMember = useUpdateArtistMembership;

export const useRemoveArtistMembership = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, membershipId }) =>
      axios.delete(`/api/artists/${artistId}/members/${membershipId}`).then((r) => r.data),
    onSuccess: (_d, { artistId }) => {
      queryClient.invalidateQueries({ queryKey: membersKey(artistId) });
      queryClient.invalidateQueries({ queryKey: ['artist-membership', artistId] });
    },
  });
};

/** @deprecated use useRemoveArtistMembership */
export const useRemoveArtistMember = useRemoveArtistMembership;

export const useAcceptArtistMembership = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, token, membershipId }) =>
      axios.post(`/api/artists/${artistId}/members/accept`, { token, membershipId }).then((r) => r.data),
    onSuccess: (_d, { artistId }) => {
      queryClient.invalidateQueries({ queryKey: membersKey(artistId) });
      queryClient.invalidateQueries({ queryKey: ['artist-membership', artistId] });
    },
  });
};
