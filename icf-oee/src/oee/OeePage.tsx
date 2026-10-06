import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cognite/aura/components/card';
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '@cognite/aura/components/empty-state';
import { Loader } from '@cognite/aura/components/loader';
import type { ReactNode } from 'react';

import logoUrl from '../assets/logo.png';

import { formatDateTime, formatPercent, summarizeTrend } from './oeeFormat';
import { summarizeSite } from './oeeKpi';
import { OeeTrendChart } from './OeeTrendChart';
import { SiteKpiTiles } from './SiteKpiTiles';
import { SiteSelect } from './SiteSelect';
import { COMPANY_NAME } from './types';
import type { TrendPoint, UnitOee } from './types';
import { UnitTable } from './UnitTable';
import { useOeeViewModel } from './useOeeViewModel';
import type { DataRegion } from './useOeeViewModel';

export function OeePage() {
  const { sites, selectedSiteId, selectSite, units, selectedUnit, selectUnit, trend } = useOeeViewModel();
  const selectedSite = sites.items.find((site) => site.externalId === selectedSiteId);
  const hasUnits = selectedSiteId !== null && !units.isLoading && units.error === null && units.items.length > 0;

  return (
    <main className="min-h-screen bg-muted/50 text-foreground">
      <div className="mx-auto flex w-full max-w-[min(100%,var(--container-8xl))] flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <img src={logoUrl} alt={`${COMPANY_NAME} logo`} className="h-20 w-auto shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-muted-foreground">{COMPANY_NAME}</span>
              <h1 className="text-4xl font-medium">Ice Cream Factory OEE</h1>
              <p className="max-w-[37.5rem] text-muted-foreground">
                Latest Overall Equipment Effectiveness of each unit, by site. OEE = quality × performance ×
                availability.
              </p>
            </div>
          </div>
          <SiteSelect
            sites={sites.items}
            selectedSiteId={selectedSiteId}
            isLoading={sites.isLoading}
            onSelect={selectSite}
          />
        </header>

        {sites.error !== null && <ErrorMessage message={sites.error} />}

        {hasUnits && <SiteKpiTiles summary={summarizeSite(units.items)} />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={selectedSiteId === null ? 'min-w-0 lg:col-span-3' : 'min-w-0 lg:col-span-2'}>
            <Card>
              <CardHeader>
                <CardTitle as="h2">{selectedSite ? `Units of ${selectedSite.name}` : 'Units'}</CardTitle>
                <CardDescription>{describeUnits(selectedSiteId, units)}</CardDescription>
              </CardHeader>
              <CardContent>
                <UnitsRegion
                  selectedSiteId={selectedSiteId}
                  units={units}
                  selectedUnitId={selectedUnit?.externalId ?? null}
                  onSelect={selectUnit}
                />
              </CardContent>
            </Card>
          </div>

          {selectedSiteId !== null && (
            <div className="min-w-0 lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{selectedUnit ? `OEE trend of ${selectedUnit.name}` : 'OEE trend'}</CardTitle>
                  <CardDescription>{describeTrend(selectedUnit)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendRegion selectedUnit={selectedUnit} trend={trend} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

type UnitsRegionProps = {
  selectedSiteId: string | null;
  units: DataRegion<UnitOee>;
  selectedUnitId: string | null;
  onSelect: (unitId: string) => void;
};

function UnitsRegion({ selectedSiteId, units, selectedUnitId, onSelect }: UnitsRegionProps) {
  if (selectedSiteId === null) {
    return <Empty title="No site selected" description="Select a site to see the latest OEE of its units." />;
  }
  if (units.isLoading) return <Loading label="Loading units…" />;
  if (units.error !== null) return <ErrorMessage message={units.error} />;
  if (units.items.length === 0) {
    return <Empty title="No units with OEE" description="This site has no asset with OEE time series." />;
  }
  return <UnitTable units={units.items} selectedUnitId={selectedUnitId} onSelect={onSelect} />;
}

type TrendRegionProps = {
  selectedUnit: UnitOee | null;
  trend: DataRegion<TrendPoint>;
};

function TrendRegion({ selectedUnit, trend }: TrendRegionProps) {
  if (selectedUnit === null) {
    return <Empty title="No unit selected" description="Select a unit in the table to see its OEE trend." />;
  }
  if (trend.isLoading) return <Loading label="Loading trend…" />;
  if (trend.error !== null) return <ErrorMessage message={trend.error} />;
  if (trend.items.length === 0) {
    return <Empty title="No OEE values" description="This unit has no OEE datapoint in the period." />;
  }
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <OeeTrendChart unitName={selectedUnit.name} points={trend.items} />
      <p className="text-sm text-muted-foreground">{summarizeTrendText(trend.items)}</p>
    </div>
  );
}

function describeUnits(selectedSiteId: string | null, units: DataRegion<UnitOee>): string {
  if (selectedSiteId === null || units.isLoading || units.error !== null) {
    return 'Latest value of the OEE time series of each unit.';
  }
  const count = units.items.length;
  return `${count} ${count === 1 ? 'unit' : 'units'}, lowest OEE first. Select a row to see the trend.`;
}

function describeTrend(selectedUnit: UnitOee | null): string {
  if (selectedUnit === null) return 'Hourly average over the 7 days that end at the latest value.';
  return `${selectedUnit.externalId} · hourly average, 7 days`;
}

/** Text summary of the chart, so the key figures do not depend on reading the curve. */
function summarizeTrendText(points: TrendPoint[]): string {
  const summary = summarizeTrend(points);
  if (summary === null) return '';
  return (
    `From ${formatDateTime(summary.start)} to ${formatDateTime(summary.end)}: ` +
    `mean ${formatPercent(summary.mean)}, minimum ${formatPercent(summary.min)}, maximum ${formatPercent(summary.max)}, ` +
    `${summary.hoursBelowAlert} of ${summary.hours} hours below 70% (dashed line).`
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-3 text-muted-foreground" aria-live="polite">
      <Loader size={20} />
      <span>{label}</span>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <Alert variant="error">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function Empty({ title, description }: { title: string; description: ReactNode }) {
  return (
    <EmptyState>
      <EmptyStateTitle as="h3">{title}</EmptyStateTitle>
      <EmptyStateDescription>{description}</EmptyStateDescription>
    </EmptyState>
  );
}
