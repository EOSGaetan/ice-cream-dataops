import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './AppErrorBoundary';

describe(AppErrorBoundary.name, () => {
  beforeEach(() => {
    // React reports the caught error on the console; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing fails', () => {
    render(
      <AppErrorBoundary>
        <p>Content</p>
      </AppErrorBoundary>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows a message instead of a blank page when a child throws', () => {
    render(
      <AppErrorBoundary>
        <Unstable source={{ shouldFail: true }} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('The page could not be displayed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders the children again after Try again', async () => {
    const source = { shouldFail: true };
    render(
      <AppErrorBoundary>
        <Unstable source={source} />
      </AppErrorBoundary>
    );
    source.shouldFail = false;

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});

function Unstable({ source }: { source: { shouldFail: boolean } }) {
  if (source.shouldFail) throw new Error('render failed');
  return <p>Recovered</p>;
}
