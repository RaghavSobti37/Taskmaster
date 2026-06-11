import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageSkeleton } from './ui';
import { useArtistMembership } from '../hooks/queries/artistMembers';
import { isMembershipAccepted } from '../utils/artistMemberPermissions';
import { isArtistManagerUser } from '../utils/pagePermissions';
import ArtistWorkspaceNoAccess from '../pages/artists/workspace/ArtistWorkspaceNoAccess';

export default function ArtistMembershipRoute({ children }) {
  const { id } = useParams();
  const { user, loading, sessionReady } = useAuth();
  const { data: membership, isLoading: membershipLoading } = useArtistMembership(id);

  if (loading || !sessionReady || membershipLoading) return <PageSkeleton />;

  const isManager = isArtistManagerUser(user);
  const hasMembership = isMembershipAccepted(membership);
  const hasAccess = hasMembership || isManager;

  if (!hasAccess) {
    if (membership && !membership.acceptedAt) {
      return <ArtistWorkspaceNoAccess reason="pending" />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
