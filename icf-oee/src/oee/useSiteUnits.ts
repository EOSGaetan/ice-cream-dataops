import { useQuery } from '@tanstack/react-query';

import { useOeeDeps } from './oeeDeps';

/** The sites of the project. Every caller shares the same cached request. */
export function useSitesQuery() {
  const { service } = useOeeDeps();
  return useQuery({
    queryKey: ['oee', 'sites'],
    queryFn: () => service.listSites(),
  });
}

/**
 * Every unit of every site with its latest OEE, read once for the overview, the unit types and
 * the export (about a dozen requests instead of a set of requests per site).
 */
export function useAllUnitsQuery(enabled: boolean) {
  const { service } = useOeeDeps();
  return useQuery({
    queryKey: ['oee', 'allUnits'],
    queryFn: () => service.listAllUnits(),
    enabled,
  });
}

/** The latest of the given timestamps, or null when there is none. */
export function latestTimestamp(timestamps: (number | null)[]): number | null {
  let latest: number | null = null;
  for (const timestamp of timestamps) {
    if (timestamp !== null && (latest === null || timestamp > latest)) latest = timestamp;
  }
  return latest;
}
