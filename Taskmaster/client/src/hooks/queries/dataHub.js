import { useMutation, useQuery } from '@tanstack/react-query';
import { buildAutoMailerUrl } from '../../utils/autoMailerUrl';

export const DATA_HUB_REFRESH_MS = 3 * 60 * 60 * 1000;

const movedToAutoMailer = () => ({
  moved: true,
  service: 'auto-mailer',
  url: buildAutoMailerUrl('/data-hub'),
  message: 'Data Hub email/audience workflows moved to Auto-Mailer',
});

const emptyFolders = () => ({ ...movedToAutoMailer(), folders: [], totals: {} });
const emptyPeople = () => ({ ...movedToAutoMailer(), people: [], rows: [], total: 0, page: 1, pages: 1 });
const emptyAnalytics = () => ({ ...movedToAutoMailer(), totals: {}, byFolder: [], charts: [] });
const emptyBackups = () => ({ ...movedToAutoMailer(), backups: [] });
const idleBackupProgress = () => ({ ...movedToAutoMailer(), status: 'moved' });

const useMovedQuery = (queryKey, queryFn, options = {}) => useQuery({
  queryKey,
  queryFn: async () => queryFn(),
  enabled: options.enabled !== false,
  staleTime: Infinity,
  refetchInterval: false,
  refetchOnWindowFocus: false,
  refetchOnMount: options.refetchOnMount,
});

const useMovedMutation = () => useMutation({
  mutationFn: async () => movedToAutoMailer(),
});

export const useDataHubFolders = (options = {}) =>
  useMovedQuery(['dataHub', 'folders'], emptyFolders, options);

export const useDataHubPeople = (params, options = {}) =>
  useMovedQuery(['dataHub', 'people', params], emptyPeople, options);

export const useDataHubPerson = (id) =>
  useMovedQuery(['dataHub', 'person', id, 'base'], () => ({ ...movedToAutoMailer(), person: null }), { enabled: !!id });

export const useDataHubPersonFull = (id) =>
  useMovedQuery(['dataHub', 'person', id, 'full'], () => ({ ...movedToAutoMailer(), person: null }), { enabled: !!id });

export const useDataHubPersonSection = (id, section) =>
  useMovedQuery(['dataHub', 'person', id, 'section', section], () => ({ ...movedToAutoMailer(), rows: [] }), {
    enabled: !!id && !!section,
  });

export const useDataHubAnalytics = (folder = 'all', options = {}) =>
  useMovedQuery(['dataHub', 'analytics', folder], emptyAnalytics, options);

export const useDataHubSyncStatus = (options = {}) =>
  useMovedQuery(['dataHub', 'syncStatus'], () => ({ ...movedToAutoMailer(), reconcileEnabled: false }), options);

export const useDataHubReconcile = () => useMovedMutation();
export const useDataHubRebuildPersonHub = () => useMovedMutation();

export const useDataHubBackups = (options = {}) =>
  useMovedQuery(['dataHub', 'backups'], emptyBackups, options);

export const useDataHubBackupProgress = (enabled = false) =>
  useMovedQuery(['dataHub', 'backup-progress'], idleBackupProgress, { enabled });

export const useDataHubBulkDeletePeople = () => useMovedMutation();
export const useDataHubProductionBackup = () => useMovedMutation();
