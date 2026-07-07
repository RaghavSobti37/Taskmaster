import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export function useIntegrationProviders() {
  return useQuery({
    queryKey: ['integrations', 'providers'],
    queryFn: async () => {
      const { data } = await axios.get('/api/integrations/providers');
      return data;
    },
  });
}

export function useIntegrationConnections() {
  return useQuery({
    queryKey: ['integrations', 'connections'],
    queryFn: async () => {
      const { data } = await axios.get('/api/integrations/connections');
      return data.connections || [];
    },
  });
}

export function useConnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, apiKey, label, mode }) => {
      const returnPath = `${window.location.pathname}${window.location.search.includes('tab=') ? window.location.search : '?tab=integrations'}`;
      const { data } = await axios.post(`/api/integrations/${provider}/connect`, {
        apiKey,
        label,
        mode,
        returnUrl: `${window.location.origin}${returnPath}`,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await axios.post(`/api/integrations/connections/${id}/disconnect`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useIntegrationHealth() {
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await axios.post(`/api/integrations/connections/${id}/health`);
      return data;
    },
  });
}

export function useIntegrationSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await axios.post(`/api/integrations/connections/${id}/sync`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function usePatchIntegrationMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, metadata }) => {
      const { data } = await axios.patch(`/api/integrations/connections/${id}/metadata`, { metadata });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useWebhookDeliveries(webhookId) {
  return useQuery({
    queryKey: ['enterprise', 'webhook-deliveries', webhookId],
    queryFn: async () => {
      const params = webhookId ? { webhookId } : {};
      const { data } = await axios.get('/api/enterprise/webhooks/deliveries', { params });
      return data.deliveries || [];
    },
  });
}
