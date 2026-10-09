import { DataGrid } from '@cognite/aura/data-grid';
import type { ColumnDef } from '@tanstack/react-table';

import { useTableHeights } from './oeeDeps';
import { formatPercent } from './oeeFormat';
import { OeeValue } from './OeeValue';
import { formatChange } from './weeklyReport';
import type { ReportFigures, ReportSiteRow, ReportTypeRow, ReportUnitRow } from './weeklyReport';

/** The four figures every table of the report shows for its rows. */
function figureColumns<Row extends { figures: ReportFigures }>(): ColumnDef<Row>[] {
  return [
    {
      id: 'meanOee',
      header: 'Mean OEE',
      accessorFn: (row) => row.figures.meanOee ?? undefined,
      sortUndefined: 'last',
      size: 100,
      cell: ({ row }) => <OeeValue ratio={row.original.figures.meanOee} />,
    },
    {
      id: 'previous',
      header: 'Week before',
      accessorFn: (row) => row.figures.previousMeanOee ?? undefined,
      sortUndefined: 'last',
      size: 112,
      cell: ({ row }) => formatPercent(row.original.figures.previousMeanOee),
    },
    {
      id: 'change',
      header: 'Change',
      accessorFn: (row) => row.figures.change ?? undefined,
      sortUndefined: 'last',
      size: 100,
      cell: ({ row }) => formatChange(row.original.figures.change),
    },
    {
      id: 'belowAlert',
      header: 'Time below 70%',
      accessorFn: (row) => row.figures.belowAlertShare ?? undefined,
      sortUndefined: 'last',
      size: 140,
      cell: ({ row }) => formatPercent(row.original.figures.belowAlertShare),
    },
  ];
}

const SITE_COLUMNS: ColumnDef<ReportSiteRow>[] = [
  { id: 'site', header: 'Site', accessorFn: (row) => row.site.name, size: 140 },
  { id: 'units', header: 'Units', accessorFn: (row) => row.unitCount, size: 70 },
  ...figureColumns<ReportSiteRow>(),
  {
    id: 'lowestUnit',
    header: 'Lowest unit',
    accessorFn: (row) =>
      row.lowestUnit === null ? '–' : `${row.lowestUnit.name} (${formatPercent(row.lowestUnit.meanOee)})`,
    size: 240,
  },
];

const TYPE_COLUMNS: ColumnDef<ReportTypeRow>[] = [
  { id: 'name', header: 'Unit type', accessorFn: (row) => row.name, size: 200 },
  { id: 'units', header: 'Units', accessorFn: (row) => row.unitCount, size: 70 },
  ...figureColumns<ReportTypeRow>(),
];

const UNIT_COLUMNS: ColumnDef<ReportUnitRow>[] = [
  { id: 'site', header: 'Site', accessorFn: (row) => row.site.name, size: 130 },
  { id: 'unit', header: 'Unit', accessorFn: (row) => row.unit.name, size: 190 },
  { id: 'externalId', header: 'External ID', accessorFn: (row) => row.unit.externalId, size: 150 },
  ...figureColumns<ReportUnitRow>(),
];

const PINNED_FIRST = ['site'];
const PINNED_NAME = ['name'];

export function ReportSitesTable({ rows }: { rows: ReportSiteRow[] }) {
  const { rowHeight, headerHeight } = useTableHeights();
  return (
    // DataGrid is virtualized: it fills its parent, which needs a size.
    <div className="h-[26rem] w-full min-w-0">
      <DataGrid
        aria-label="Sites over the week"
        data={rows}
        columns={SITE_COLUMNS}
        getRowId={(row) => row.site.externalId}
        enableSorting
        pinnedColumns={PINNED_FIRST}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
      />
    </div>
  );
}

export function ReportTypesTable({ rows }: { rows: ReportTypeRow[] }) {
  const { rowHeight, headerHeight } = useTableHeights();
  return (
    <div className="h-[26rem] w-full min-w-0">
      <DataGrid
        aria-label="Unit types with the most time below 70% over the week"
        data={rows}
        columns={TYPE_COLUMNS}
        getRowId={(row) => row.name}
        enableSorting
        pinnedColumns={PINNED_NAME}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
      />
    </div>
  );
}

export function ReportUnitsTable({ rows }: { rows: ReportUnitRow[] }) {
  const { rowHeight, headerHeight } = useTableHeights();
  return (
    <div className="h-[26rem] w-full min-w-0">
      <DataGrid
        aria-label="Units with the lowest mean OEE over the week"
        data={rows}
        columns={UNIT_COLUMNS}
        getRowId={(row) => `${row.site.externalId}/${row.unit.externalId}`}
        enableSorting
        pinnedColumns={PINNED_FIRST}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
      />
    </div>
  );
}
