import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cognite/aura/components/card';

import { formatPercent } from './oeeFormat';
import { Empty, ErrorMessage, Loading } from './OeeStates';
import { TrendRangeControl } from './TrendRangeControl';
import { getTrendRange } from './types';
import { UnitTypeDetail } from './UnitTypeDetail';
import type { UnitTypeStats } from './unitTypes';
import { UnitTypesChart } from './UnitTypesChart';
import { UnitTypesTable } from './UnitTypesTable';
import type { OeeViewModel } from './useOeeViewModel';

/** How many unit types the ranking chart shows. */
const CHART_TYPE_COUNT = 10;

type UnitTypesViewProps = Pick<
  OeeViewModel,
  'unitTypes' | 'selectedUnitType' | 'selectUnitType' | 'openUnit' | 'trendRange' | 'selectTrendRange'
>;

/** The unit types tab: which kind of unit causes the most problems worldwide. */
export function UnitTypesView({
  unitTypes,
  selectedUnitType,
  selectUnitType,
  openUnit,
  trendRange,
  selectTrendRange,
}: UnitTypesViewProps) {
  const range = getTrendRange(trendRange);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[37.5rem] text-muted-foreground">
          The units of all sites, grouped by name. A type that spends more time below 70% OEE over the last{' '}
          {range.period} ranks higher.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Time frame</span>
          <TrendRangeControl range={trendRange} onSelect={selectTrendRange} label="Time frame of the statistics" />
        </div>
      </div>

      <UnitTypesRegion
        isLoading={unitTypes.isLoading}
        error={unitTypes.error}
        unitTypes={unitTypes.items}
        bucket={range.bucket}
        selectedUnitType={selectedUnitType}
        onSelect={selectUnitType}
        onOpenUnit={openUnit}
      />
    </div>
  );
}

type UnitTypesRegionProps = {
  isLoading: boolean;
  error: string | null;
  unitTypes: UnitTypeStats[];
  bucket: string;
  selectedUnitType: UnitTypeStats | null;
  onSelect: (name: string) => void;
  onOpenUnit: (siteId: string, unitId: string) => void;
};

function UnitTypesRegion({
  isLoading,
  error,
  unitTypes,
  bucket,
  selectedUnitType,
  onSelect,
  onOpenUnit,
}: UnitTypesRegionProps) {
  if (error !== null) return <ErrorMessage message={error} />;
  if (isLoading) return <Loading label="Loading the statistics of every unit…" />;
  if (unitTypes.length === 0) {
    return <Empty title="No unit statistics" description="No unit has an OEE value in this time frame." />;
  }
  const charted = unitTypes.slice(0, CHART_TYPE_COUNT);
  const unitCount = unitTypes.reduce((sum, type) => sum + type.unitCount, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Most problematic unit types</CardTitle>
          <CardDescription>{describeRanking(charted, bucket)}</CardDescription>
        </CardHeader>
        <CardContent>
          <UnitTypesChart unitTypes={charted} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Unit types</CardTitle>
              <CardDescription>
                {`${unitTypes.length} types, ${unitCount} units. Select a row to see the units of a type.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UnitTypesTable unitTypes={unitTypes} selectedName={selectedUnitType?.name ?? null} onSelect={onSelect} />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{selectedUnitType ? `${selectedUnitType.name} by site` : 'Units of a type'}</CardTitle>
              <CardDescription>
                {selectedUnitType
                  ? `${selectedUnitType.unitCount} units in ${selectedUnitType.siteCount} sites. Select a row to open the unit.`
                  : 'The units of the selected type, site by site.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUnitType === null ? (
                <Empty title="No unit type selected" description="Select a unit type in the table to see its units." />
              ) : (
                <UnitTypeDetail members={selectedUnitType.members} onOpenUnit={onOpenUnit} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Text summary of the chart, so the ranking does not depend on reading the bars. */
function describeRanking(charted: UnitTypeStats[], bucket: string): string {
  const top = charted
    .slice(0, 3)
    .map((type) => `${type.name} (${formatPercent(type.belowAlertShare)})`)
    .join(', ');
  return `Share of the ${bucket} averages below 70% OEE, all sites together. Highest: ${top}.`;
}
