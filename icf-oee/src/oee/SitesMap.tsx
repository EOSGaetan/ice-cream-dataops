import { HoverCard, HoverCardContent, HoverCardTrigger } from '@cognite/aura/components/hover-card';

import { formatPercent } from './oeeFormat';
import { oeeLevel } from './oeeKpi';
import type { OeeLevel } from './oeeKpi';
import { getSiteCoordinates, MAP_VIEW_BOX, toMapPosition } from './siteLocations';
import { SiteLowestUnits } from './SiteLowestUnits';
import type { SiteOverview } from './useOeeViewModel';
import { WORLD_LAND_PATH } from './worldMap';

/** Data colours: the marker of a site shows the level of its mean OEE. */
const LEVEL_COLORS: Record<OeeLevel, string> = {
  critical: 'var(--chart-destructive-color-1)',
  warning: 'var(--chart-warning-color-1)',
  good: 'var(--chart-success-color-1)',
  unknown: 'var(--chart-neutral-color-1)',
};

const LEGEND: { level: OeeLevel; label: string }[] = [
  { level: 'critical', label: 'Site OEE below 70%' },
  { level: 'warning', label: '70% to 85%' },
  { level: 'good', label: '85% and above' },
];

const VIEW_BOX = `${MAP_VIEW_BOX.x} ${MAP_VIEW_BOX.y} ${MAP_VIEW_BOX.width} ${MAP_VIEW_BOX.height}`;

type SitesMapProps = {
  sites: SiteOverview[];
  onOpenSite: (siteId: string) => void;
};

export function SitesMap({ sites, onOpenSite }: SitesMapProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div
        className="relative w-full overflow-hidden rounded-xl bg-muted/50"
        style={{ aspectRatio: `${MAP_VIEW_BOX.width} / ${MAP_VIEW_BOX.height}` }}
      >
        <svg viewBox={VIEW_BOX} className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d={WORLD_LAND_PATH} className="fill-muted-foreground/25" />
        </svg>
        {sites.map((overview) => (
          <SiteMarker key={overview.site.externalId} overview={overview} onOpenSite={onOpenSite} />
        ))}
      </div>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {LEGEND.map(({ level, label }) => (
          <li key={level} className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS[level] }} />
            {label}
          </li>
        ))}
        <li>Hover a site to see its three lowest units; select it to open the site.</li>
      </ul>
    </div>
  );
}

type SiteMarkerProps = {
  overview: SiteOverview;
  onOpenSite: (siteId: string) => void;
};

function SiteMarker({ overview, onOpenSite }: SiteMarkerProps) {
  const { site, summary } = overview;
  const coordinates = getSiteCoordinates(site.externalId);
  // A site without known coordinates is still listed in the table below the map.
  if (coordinates === null) return null;
  const { left, top } = toMapPosition(coordinates);
  const level = oeeLevel(summary?.meanOee);

  return (
    <HoverCard openDelay={80} closeDelay={80}>
      <HoverCardTrigger
        render={<button type="button" />}
        className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:shadow-focus-ring"
        style={{ left: `${left}%`, top: `${top}%` }}
        aria-label={describeMarker(overview)}
        onClick={() => onOpenSite(site.externalId)}
      >
        <span
          aria-hidden
          className="size-4 rounded-full border-2 border-background shadow-sm"
          style={{ backgroundColor: LEVEL_COLORS[level] }}
        />
      </HoverCardTrigger>
      <HoverCardContent side="top">
        <SiteLowestUnits overview={overview} />
      </HoverCardContent>
    </HoverCard>
  );
}

function describeMarker({ site, summary, lowestUnits }: SiteOverview): string {
  if (summary === null) return `${site.name}: loading`;
  const lowest = lowestUnits.map((unit) => `${unit.name} ${formatPercent(unit.oee)}`).join(', ');
  return `${site.name}: site OEE ${formatPercent(summary.meanOee)}. Lowest units: ${lowest || 'none'}.`;
}
