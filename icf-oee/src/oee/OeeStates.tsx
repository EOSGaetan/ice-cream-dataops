import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@cognite/aura/components/empty-state';
import { Loader } from '@cognite/aura/components/loader';
import type { ReactNode } from 'react';

export function Loading({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-3 text-muted-foreground" aria-live="polite">
      <Loader size={20} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <Alert variant="error">
      <AlertDescription>{message}</AlertDescription>
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
