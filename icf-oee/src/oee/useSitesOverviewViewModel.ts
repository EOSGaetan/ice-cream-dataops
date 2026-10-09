import { lowestUnits, summarizeSite } from './oeeKpi';
import { toErrorMessage } from './oeeRegions';
import type { DataRegion, QueryState, SiteOverview } from './oeeRegions';
import { useOeeState } from './oeeState';
import type { Site, SiteUnit } from './types';
import { useAllUnitsQuery, useSitesQuery } from './useSiteUnits';

/** How many of the lowest units the overview shows per site. */
const LOWEST_UNIT_COUNT = 3;

export type SitesOverviewViewModel = {
  /** Every site with its summary and its lowest units; empty outside the overview tab. */
  overview: DataRegion<SiteOverview>;
};

/** The overview tab: every site, summarized from one read of the units of all sites. */
export function useSitesOverviewViewModel(): SitesOverviewViewModel {
  const { state } = useOeeState();
  const isShown = state.view === 'overview';

  const sitesQuery = useSitesQuery();
  const allUnitsQuery = useAllUnitsQuery(isShown);

  return {
    overview: {
      items: isShown ? (sitesQuery.data ?? []).map((site) => toSiteOverview(site, allUnitsQuery)) : [],
      isLoading: sitesQuery.isLoading,
      error: toErrorMessage('The sites could not be loaded.', sitesQuery.error),
    },
  };
}

function toSiteOverview(site: Site, query: QueryState<SiteUnit>): SiteOverview {
  const units = query.data?.filter((siteUnit) => siteUnit.site.externalId === site.externalId).map(({ unit }) => unit);
  return {
    site,
    summary: units === undefined ? null : summarizeSite(units),
    lowestUnits: units === undefined ? [] : lowestUnits(units, LOWEST_UNIT_COUNT),
    isLoading: query.isLoading,
    error: toErrorMessage('The units could not be loaded.', query.error),
  };
}
