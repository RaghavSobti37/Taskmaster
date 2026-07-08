import { useMutation } from '@tanstack/react-query';
import { enqueueBackgroundMutation } from '../lib/backgroundMutationQueue';

const RETRYABLE_STATUS = new Set([0, 502, 503, 504]);

function isRetryableError(err) {
  const status = err?.response?.status ?? 0;
  return RETRYABLE_STATUS.has(status) || err?.code === 'ERR_NETWORK';
}

/**
 * useMutation + optimistic onMutate + background retry on transient failure.
 */
export function useQueuedOptimisticMutation(options) {
  const {
    mutationFn,
    onMutate,
    onError,
    onSuccess,
    onSettled,
    queueLabel,
    maxQueueRetries = 3,
    ...rest
  } = options;

  return useMutation({
    ...rest,
    mutationFn,
    onMutate,
    onSuccess,
    onSettled,
    onError: (err, variables, context) => {
      if (isRetryableError(err) && typeof mutationFn === 'function') {
        enqueueBackgroundMutation(
          () => mutationFn(variables),
          { label: queueLabel || 'mutation', maxRetries: maxQueueRetries },
        );
      }
      onError?.(err, variables, context);
    },
  });
}
