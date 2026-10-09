import { Alert, AlertActions, AlertButton, AlertDescription } from '@cognite/aura/components/alert';
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@cognite/aura/components/empty-state';
import { Loader } from '@cognite/aura/components/loader';
import type { ReactNode } from 'react';

import { TOUCH_FIELD_CLASS } from './touchScreen';
import { useRetryFailedReads } from './useRetryFailedReads';

export function Loading({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-3 text-muted-foreground" aria-live="polite">
      <Loader size={20} />
      <span>{label}</span>
    </div>
  );
}

/** A failed read: what happened, and a way to read again what failed. */
export function ErrorMessage({ message }: { message: string }) {
  const retry = useRetryFailedReads();
  return (
    <Alert variant="error">
      <AlertDescription>{message}</AlertDescription>
      <AlertActions>
        <AlertButton className={TOUCH_FIELD_CLASS} onClick={retry}>
          Try again
        </AlertButton>
      </AlertActions>
    </Alert>
  );
}

export function Empty({ title, description }: { title: string; description: ReactNode }) {
  return (
    <EmptyState>
      <EmptyStateTitle as="h3">{title}</EmptyStateTitle>
      <EmptyStateDescription>{description}</EmptyStateDescription>
    </EmptyState>
  );
}
