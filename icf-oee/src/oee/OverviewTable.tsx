import { DataGrid } from '@cognite/aura/data-grid';
import type { ColumnDef } from '@tanstack/react-table';

import { useTableHeights } from './oeeDeps';
import { OeeValue } from './OeeValue';
import { SiteOeeValue } from './SiteOeeValue';
import type { UnitOee } from './types';
import type { SiteOverview } from './useOeeViewModel';

/** Lowest site OEE first. */
const DEFAULT_SORTING = [{ id: 'siteOee', desc: false }];
const PINNED_COLUMNS = ['site'];

const COLUMNS: ColumnDef<SiteOverview>[] = [
  { id: 'site', header: 'Site', accessorFn: (row) => row.site.name, size: 150 },
  {
    id: 'siteOee',
    header: 'Site OEE',
    accessorFn: (row) => row.summary?.meanOee ?? undefined,
    sortUndefined: 'last',
    size: 120,
    // The OEE of a site follows the colour code of the map; the units keep their own thresholds.
    cell: ({ row }) => (row.original.summary === null ? '…' : <SiteOeeValue ratio={row.original.summary.meanOee} />),
  },
  { id: 'units', header: 'Units', accessorFn: (row) => row.summary?.unitCount ?? undefined, sortUndefined: 'last', size: 80 },
  {
    id: 'belowAlert',
    header: 'Below 70%',
    accessorFn: (row) => row.summary?.belowAlertCount ?? undefined,
    sortUndefined: 'last',
    size: 110,
  },
  lowestUnitColumn(0, 'Lowest unit'),
  lowestUnitColumn(1, '2nd lowest'),
  lowestUnitColumn(2, '3rd lowest'),
];

type OverviewTableProps = {
  sites: SiteOverview[];
  onOpenSite: (siteId: string) => void;
};

export function OverviewTable({ sites, onOpenSite }: OverviewTableProps) {
  const { rowHeight, headerHeight } = useTableHeights();
  return (
    // DataGrid is virtualized: it fills its parent, which needs a size (10 sites and the header).
    <div className="h-[25.5rem] w-full min-w-0 pointer-coarse:h-[28rem]">
      <DataGrid
        aria-label="Lowest OEE units by site"
        data={sites}
        columns={COLUMNS}
        getRowId={(row) => row.site.externalId}
        onRowClick={(row) => onOpenSite(row.original.site.externalId)}
        enableSorting
        defaultSorting={DEFAULT_SORTING}
        pinnedColumns={PINNED_COLUMNS}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
      />
    </div>
  );
}

/** A column for the unit at one rank of the lowest OEE of the site: its name and its OEE. */
function lowestUnitColumn(rank: number, header: string): ColumnDef<SiteOverview> {
  return {
    id: `lowest${rank + 1}`,
    header,
    accessorFn: (row) => row.lowestUnits[rank]?.oee ?? undefined,
    sortUndefined: 'last',
    size: 250,
    cell: ({ row }) => {
      const unit: UnitOee | undefined = row.original.lowestUnits[rank];
      if (unit === undefined) return row.original.summary === null ? '…' : '–';
      return (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 truncate" title={`${unit.name} (${unit.externalId})`}>
            {unit.name}
          </span>
          <OeeValue ratio={unit.oee} />
        </span>
      );
    },
  };
}
