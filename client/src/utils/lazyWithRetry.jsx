import { lazy } from 'react';
import { isStaleChunkError, recoverFromStaleChunks } from './chunkRecovery';

export function createLazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      if (isStaleChunkError(error)) {
        await recoverFromStaleChunks();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}
