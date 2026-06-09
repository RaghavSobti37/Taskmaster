import React from 'react';
import TabHubLayout from './TabHubLayout';
import LeadsPage from '../crm/LeadsPage';
import FollowupsPage from '../crm/FollowupsPage';
import ExlyBookingsPage from '../crm/ExlyBookingsPage';
import ArtistBookingEnquiriesPage from '../crm/ArtistBookingEnquiriesPage';
import { useAuth } from '../../contexts/AuthContext';
import { isArtistOnlyCrmUser } from '../../utils/crmScope';
import { isSalesUser } from '../../utils/departmentPermissions';

export default function CrmHub() {
  const { user } = useAuth();
  const artistOnly = isArtistOnlyCrmUser(user);
  const salesUser = isSalesUser(user);

  const bookingsPanel = artistOnly && !salesUser
    ? ArtistBookingEnquiriesPage
    : ExlyBookingsPage;

  return (
    <TabHubLayout
      hubPath="/crm"
      panels={{
        leads: LeadsPage,
        followups: FollowupsPage,
        bookings: bookingsPanel,
      }}
    />
  );
}
