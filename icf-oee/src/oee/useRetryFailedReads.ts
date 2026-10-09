import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/** Reads again everything that failed, and only that: what loaded stays on screen. */
export function useRetryFailedReads(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.refetchQueries({
      queryKey: ['oee'],
      predicate: (query) => query.state.status === 'error',
    });
  }, [queryClient]);
}
