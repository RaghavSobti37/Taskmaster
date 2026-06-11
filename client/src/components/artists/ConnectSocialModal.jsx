import React from 'react';
import { NexusModal } from '../ui/modals';
import SocialConnectionsCenter from './SocialConnectionsCenter';

export default function ConnectSocialModal({ isOpen, onClose, artistId, connections = [] }) {
  return (
    <NexusModal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Platforms"
      subtitle="Link accounts to sync analytics and manage your artist presence"
      showFooter={false}
      size="xl"
    >
      <SocialConnectionsCenter
        artistId={artistId}
        connections={connections}
      />
    </NexusModal>
  );
}
