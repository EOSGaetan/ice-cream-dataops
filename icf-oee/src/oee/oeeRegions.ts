import { explainError } from './oeeErrors';
import type { SiteSummary } from './oeeKpi';
import type { Site, UnitOee } from './types';

/** What a view needs to show one list of data: the items, or that they load, or why they failed. */
export type DataRegion<T> = {
  items: T[];
  isLoading: boolean;
  /** A message to show, or null when the last request succeeded. */
  error: string | null;
};

/** One site of the overview: its summary and its units with the lowest OEE. */
export type SiteOverview = {
  site: Site;
  /** Null while the units of the site load, or when they could not be loaded. */
  summary: SiteSummary | null;
  lowestUnits: UnitOee[];
  isLoading: boolean;
  error: string | null;
};

/** The part of a query result the regions are built from. */
export type QueryState<T> = {
  data: T[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

/** `message` says what could not be loaded; the cause is added in plain words. */
export function toErrorMessage(message: string, error: Error | null): string | null {
  return error === null ? null : `${message} ${explainError(error)}`.trim();
}

export function toRegion<T>(query: QueryState<T>, message: string): DataRegion<T> {
  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: toErrorMessage(message, query.error),
  };
}
