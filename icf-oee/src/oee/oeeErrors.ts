/**
 * What to tell the user about a failed read: for the usual CDF answers, what happened and what
 * to do next in plain words; otherwise the message of the error.
 */
export function explainError(error: unknown): string {
  const status = readStatus(error);
  if (status === 401 || status === 403) {
    return `You do not have access to this data (${status}). Ask the administrator of the CDF project for read access.`;
  }
  if (status === 429) {
    return 'CDF is receiving too many requests (429). Wait a moment, then try again.';
  }
  if (status !== null && status >= 500) {
    return `CDF had a problem (${status}). Try again in a moment.`;
  }
  return error instanceof Error ? error.message : '';
}

/** The HTTP status that the Cognite SDK puts on its errors, or null. */
function readStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}
