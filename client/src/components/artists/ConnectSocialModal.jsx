import React from 'react';
import { FaSpotify, FaYoutube, FaInstagram, FaFacebook } from 'react-icons/fa';
import { NexusModal } from '../ui/modals';
import { Badge } from '../ui';
import ConnectAccountButton from './ConnectAccountButton';
import { analyticsIntegrations, byId } from '../../config/integrations.config';

const ICONS = { spotify: FaSpotify, youtube: FaYoutube, instagram: FaInstagram, facebook: FaFacebook };

function findConnection(connections, provider) {
  return connections.find((c) => c.provider === provider && c.isPrimary)
    || connections.find((c) => c.provider === provider)
    || (provider === 'instagram' ? connections.find((c) => c.provider === 'meta') : null);
}

function getPlatformStatus(provider, connections) {
  const conn = findConnection(connections, provider);
  const hasHandle = !!(conn?.accountHandle);
  const isConnected = hasHandle || conn?.status === 'active';
  const needsOAuth = provider === 'instagram' && hasHandle && !conn?.authenticated;
  if (needsOAuth) return { status: 'needs_oauth', conn };
  if (isConnected) return { status: 'connected', conn };
  return { status: 'disconnected', conn: null };
}

export default function ConnectSocialModal({ isOpen, onClose, artistId, connections = [] }) {
  const platforms = analyticsIntegrations();

  return (
    <NexusModal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Social Media"
      subtitle="Link accounts to sync analytics and manage content"
      showFooter={false}
      size="md"
    >
      <div className="space-y-3">
        {platforms.map((platform) => {
          const { status, conn } = getPlatformStatus(platform.id, connections);
          const Icon = ICONS[platform.id];
          const config = byId(platform.id);

          return (
            <div
              key={platform.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                {Icon && <Icon size={20} className="shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{config?.name}</p>
                  {conn?.accountLabel && (
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{conn.accountLabel}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <Badge variant={status === 'connected' ? 'success' : status === 'needs_oauth' ? 'warning' : 'info'}>
                  {status === 'connected' ? 'Connected' : status === 'needs_oauth' ? 'Needs Login' : 'Not Connected'}
                </Badge>
                {platform.hasOAuth ? (
                  <ConnectAccountButton
                    provider={platform.id}
                    artistId={artistId}
                    variant="compact"
                    label={status === 'connected' ? 'Reconnect' : status === 'needs_oauth' ? 'Login' : 'Connect'}
                  />
                ) : (
                  <span className="text-[10px] font-medium text-[var(--color-text-muted)]">Edit profile to add</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </NexusModal>
  );
}
