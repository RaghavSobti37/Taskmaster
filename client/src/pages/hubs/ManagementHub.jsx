import React from 'react';
import TabHubLayout from './TabHubLayout';
import FinancePage from '../finance/FinancePage';
import AnnouncementsPage from '../management/AnnouncementsPage';
import SystemLogsPage from '../admin/SystemLogsPage';
import ArtistsCollection from '../artists/ArtistsCollection';

export default function ManagementHub() {
  return (
    <TabHubLayout
      hubPath="/management"
      panels={{
        finance: FinancePage,
        announcements: AnnouncementsPage,
        'ops-logs': SystemLogsPage,
        artists: ArtistsCollection,
      }}
    />
  );
}
