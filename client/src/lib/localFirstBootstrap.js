import {
  initLocalDatabase,
  estimateStorageQuota,
  localQuery,
} from '@coreknot/local-database';
import { fetchSyncCredentialsFromApi } from '@coreknot/sync-client';

export async function bootstrapLocalFirst() {
  const ping = await initLocalDatabase();
  const quota = await estimateStorageQuota();

  if (import.meta.env.DEV) {
    console.info('[local-first] worker ready', ping, quota);
  }

  return { ping, quota };
}

export async function connectSyncEngine() {
  try {
    return await fetchSyncCredentialsFromApi('');
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[local-first] sync credentials unavailable', err?.message);
    }
    return null;
  }
}

export async function readLocalTasks(projectId) {
  if (!projectId) return [];
  return localQuery(
    'SELECT id, title, status, sync_status AS syncStatus, updated_at AS updatedAt FROM tasks WHERE project_id = ? ORDER BY updated_at DESC',
    [projectId],
  );
}
