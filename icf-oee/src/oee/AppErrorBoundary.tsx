import { Alert, AlertActions, AlertButton, AlertDescription, AlertTitle } from '@cognite/aura/components/alert';
import type { ReactNode } from 'react';
import { Component } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasFailed: boolean;
};

/**
 * Catches an error thrown while rendering the page, so the user sees a message and a way to
 * retry instead of a blank app.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { hasFailed: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasFailed: true };
  }

  public render(): ReactNode {
    if (!this.state.hasFailed) return this.props.children;

    return (
      <main className="min-h-screen bg-muted/50 text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-8">
          <Alert variant="error">
            <AlertTitle>The page could not be displayed</AlertTitle>
            <AlertDescription>
              An unexpected error stopped the app. Your selection is kept in the address: try again, or reload the
              page.
            </AlertDescription>
            <AlertActions>
              <AlertButton onClick={() => this.setState({ hasFailed: false })}>Try again</AlertButton>
            </AlertActions>
          </Alert>
        </section>
      </main>
    );
  }
}
