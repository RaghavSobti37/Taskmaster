import React from 'react';
import TabHubLayout from './TabHubLayout';
import EquipmentPage from '../management/EquipmentPage';
import ContactsPage from '../management/ContactsPage';
import SubscriptionsPage from '../office/SubscriptionsPage';

export default function OfficeHub() {
  return (
    <TabHubLayout
      hubPath="/office"
      panels={{
        equipment: EquipmentPage,
        contacts: ContactsPage,
        subscriptions: SubscriptionsPage,
      }}
    />
  );
}
