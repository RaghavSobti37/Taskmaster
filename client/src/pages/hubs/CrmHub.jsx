import React from 'react';
import TabHubLayout from './TabHubLayout';
import LeadsPage from '../crm/LeadsPage';
import FollowupsPage from '../crm/FollowupsPage';
import ExlyBookingsPage from '../crm/ExlyBookingsPage';

export default function CrmHub() {
  return (
    <TabHubLayout
      hubPath="/crm"
      panels={{
        leads: LeadsPage,
        followups: FollowupsPage,
        bookings: ExlyBookingsPage,
      }}
    />
  );
}
