import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cognite/aura/components/card';

import { Empty, ErrorMessage, Loading } from './OeeStates';
import { OverviewTable } from './OverviewTable';
import { SitesMap } from './SitesMap';
import type { DataRegion, SiteOverview } from './useOeeViewModel';

type SitesOverviewProps = {
  overview: DataRegion<SiteOverview>;
  onOpenSite: (siteId: string) => void;
};

/** The overview tab: every site on a map, and the same figures in a table. */
export function SitesOverview({ overview, onOpenSite }: SitesOverviewProps) {
  if (overview.isLoading) return <Loading label="Loading sites…" />;
  if (overview.error !== null) return <ErrorMessage message={overview.error} />;
  if (overview.items.length === 0) {
    return <Empty title="No sites" description="The project has no asset without a parent." />;
  }
  const isLoadingUnits = overview.items.some((site) => site.isLoading);
  const unitsError = overview.items.find((site) => site.error !== null)?.error ?? null;

  return (
    <div className="flex flex-col gap-6">
      {unitsError !== null && <ErrorMessage message={unitsError} />}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Sites</CardTitle>
          <CardDescription>
            {isLoadingUnits
              ? `Loading the units of the ${overview.items.length} sites…`
              : `${overview.items.length} sites, coloured by the mean of the latest OEE of their units.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SitesMap sites={overview.items} onOpenSite={onOpenSite} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Lowest OEE by site</CardTitle>
          <CardDescription>The three units with the lowest latest OEE in each site. Select a row to open the site.</CardDescription>
        </CardHeader>
        <CardContent>
          <OverviewTable sites={overview.items} onOpenSite={onOpenSite} />
        </CardContent>
      </Card>
    </div>
  );
}
