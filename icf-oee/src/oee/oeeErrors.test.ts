import { describe, expect, it } from 'vitest';

import { explainError } from './oeeErrors';

describe(explainError.name, () => {
  it.each([401, 403])('says how to get access when CDF refuses with %i', (status) => {
    expect(explainError(makeHttpError(status))).toBe(
      `You do not have access to this data (${status}). Ask the administrator of the CDF project for read access.`
    );
  });

  it('says to wait when CDF limits the requests', () => {
    expect(explainError(makeHttpError(429))).toBe(
      'CDF is receiving too many requests (429). Wait a moment, then try again.'
    );
  });

  it.each([500, 503])('says to try again when CDF fails with %i', (status) => {
    expect(explainError(makeHttpError(status))).toBe(`CDF had a problem (${status}). Try again in a moment.`);
  });

  it('keeps the message of any other error', () => {
    expect(explainError(new Error('Network request failed'))).toBe('Network request failed');
    expect(explainError(makeHttpError(400))).toBe('Request failed | status code: 400');
    expect(explainError(Object.assign(new Error('odd'), { status: 'unknown' }))).toBe('odd');
  });

  it('has nothing to say about a value that is not an error', () => {
    expect(explainError('boom')).toBe('');
    expect(explainError(null)).toBe('');
  });
});

/** An error shaped like the ones the Cognite SDK throws. */
function makeHttpError(status: number): Error {
  return Object.assign(new Error(`Request failed | status code: ${status}`), { status });
}
