import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cognite/aura/components/card';
import { lazy, Suspense } from 'react';

import { FULL_CARD_DESCRIPTION, STACKED_CARD_HEADER } from './cardLayout';
import { formatDateTime, formatPercent, summarizeTrend } from './oeeFormat';
import { summarizeSite } from './oeeKpi';
import { Empty, ErrorMessage, Loading } from './OeeStates';
import { SiteKpiTiles } from './SiteKpiTiles';
import { SiteSelect } from './SiteSelect';
import { TrendRangeControl } from './TrendRangeControl';
import { getTrendRange } from './types';
import type { TrendPoint, TrendRange, TrendRangeId, UnitOee } from './types';
import { UnitTable } from './UnitTable';
import { useOeeSelection } from './useOeeSelection';
import { useSiteDetailViewModel } from './useSiteDetailViewModel';

// The chart library is the heaviest part of the app: it is loaded when a chart is first shown.
const OeeTrendChart = lazy(() => import('./OeeTrendChart').then((module) => ({ default: module.OeeTrendChart })));

/** The site tab: the units of one site and the OEE trend of the selected unit. */
export function SiteDetail() {
  const { sites, units, selectedUnit, trend } = useSiteDetailViewModel();
  const { selectedSiteId, selectSite, selectUnit, trendRange, selectTrendRange } = useOeeSelection();
  const selectedSite = sites.items.find((site) => site.externalId === selectedSiteId);
  const hasUnits = selectedSiteId !== null && !units.isLoading && units.error === null && units.items.length > 0;
  const range = getTrendRange(trendRange);

  return (
    <div className="flex flex-col gap-6">
      {sites.error !== null && <ErrorMessage message={sites.error} />}
      <SiteSelect sites={sites.items} selectedSiteId={selectedSiteId} isLoading={sites.isLoading} onSelect={selectSite} />

      {hasUnits && <SiteKpiTiles summary={summarizeSite(units.items)} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={selectedSiteId === null ? 'min-w-0 lg:col-span-3' : 'min-w-0 lg:col-span-2'}>
          <Card>
            <CardHeader className={STACKED_CARD_HEADER}>
              <CardTitle as="h2">{selectedSite ? `Units of ${selectedSite.name}` : 'Units'}</CardTitle>
              <CardDescription className={FULL_CARD_DESCRIPTION}>{describeUnits(selectedSiteId, units.isLoading, units.error, units.items.length)}</CardDescription>
            </CardHeader>
            <CardContent>
              <UnitsRegion
                selectedSiteId={selectedSiteId}
                isLoading={units.isLoading}
                error={units.error}
                units={units.items}
                selectedUnitId={selectedUnit?.externalId ?? null}
                onSelect={selectUnit}
              />
            </CardContent>
          </Card>
        </div>

        {selectedSiteId !== null && (
          <div className="min-w-0 lg:col-span-1">
            <Card>
              <CardHeader className={STACKED_CARD_HEADER}>
                <CardTitle as="h2">{selectedUnit ? `OEE trend of ${selectedUnit.name}` : 'OEE trend'}</CardTitle>
                <CardDescription className={FULL_CARD_DESCRIPTION}>{describeTrend(selectedUnit, range)}</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedUnit === null ? (
                  <Empty title="No unit selected" description="Select a unit in the table to see its OEE trend." />
                ) : (
                  <div className="flex w-full min-w-0 flex-col gap-3">
                    <TimeFrame range={trendRange} onSelect={selectTrendRange} />
                    <TrendRegion
                      unitName={selectedUnit.name}
                      range={range}
                      isLoading={trend.isLoading}
                      error={trend.error}
                      points={trend.items}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

type UnitsRegionProps = {
  selectedSiteId: string | null;
  isLoading: boolean;
  error: string | null;
  units: UnitOee[];
  selectedUnitId: string | null;
  onSelect: (unitId: string) => void;
};

function UnitsRegion({ selectedSiteId, isLoading, error, units, selectedUnitId, onSelect }: UnitsRegionProps) {
  if (selectedSiteId === null) {
    return <Empty title="No site selected" description="Select a site to see the latest OEE of its units." />;
  }
  if (isLoading) return <Loading label="Loading units…" />;
  if (error !== null) return <ErrorMessage message={error} />;
  if (units.length === 0) {
    return <Empty title="No units with OEE" description="This site has no asset with OEE time series." />;
  }
  return <UnitTable units={units} selectedUnitId={selectedUnitId} onSelect={onSelect} />;
}

function TimeFrame({ range, onSelect }: { range: TrendRangeId; onSelect: (range: TrendRangeId) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">Time frame</span>
      <TrendRangeControl range={range} onSelect={onSelect} />
    </div>
  );
}

type TrendRegionProps = {
  unitName: string;
  range: TrendRange;
  isLoading: boolean;
  error: string | null;
  points: TrendPoint[];
};

function TrendRegion({ unitName, range, isLoading, error, points }: TrendRegionProps) {
  if (isLoading) return <Loading label="Loading trend…" />;
  if (error !== null) return <ErrorMessage message={error} />;
  if (points.length === 0) {
    return <Empty title="No OEE values" description="This unit has no OEE datapoint in the period." />;
  }
  return (
    <>
      <Suspense fallback={<Loading label="Loading chart…" />}>
        <OeeTrendChart unitName={unitName} bucket={range.bucket} points={points} />
      </Suspense>
      <p className="text-sm text-muted-foreground">{summarizeTrendText(points, range)}</p>
    </>
  );
}

function describeUnits(selectedSiteId: string | null, isLoading: boolean, error: string | null, count: number): string {
  if (selectedSiteId === null || isLoading || error !== null) {
    return 'Latest value of the OEE time series of each unit.';
  }
  return `${count} ${count === 1 ? 'unit' : 'units'}, lowest OEE first. Select a row to see the trend.`;
}

function describeTrend(selectedUnit: UnitOee | null, range: TrendRange): string {
  if (selectedUnit === null) return 'Average OEE over the time frame that ends at the latest value.';
  return `${selectedUnit.externalId} · ${range.bucket} average, ${range.period}`;
}

/** Text summary of the chart, so the key figures do not depend on reading the curve. */
function summarizeTrendText(points: TrendPoint[], range: TrendRange): string {
  const summary = summarizeTrend(points);
  if (summary === null) return '';
  return (
    `From ${formatDateTime(summary.start)} to ${formatDateTime(summary.end)}: ` +
    `mean ${formatPercent(summary.mean)}, minimum ${formatPercent(summary.min)}, maximum ${formatPercent(summary.max)}, ` +
    `${summary.belowAlert} of ${summary.count} ${range.bucket} averages below 70% (dashed line).`
  );
}
