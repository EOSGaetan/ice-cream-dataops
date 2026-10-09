import { DataGrid } from '@cognite/aura/data-grid';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import { useTableHeights } from './oeeDeps';
import { formatPercent } from './oeeFormat';
import { OeeValue } from './OeeValue';
import { SelectableName } from './SelectableName';
import type { UnitTypeStats } from './unitTypes';

/** Most time below the alert threshold first. */
const DEFAULT_SORTING = [{ id: 'belowAlert', desc: true }];
const PINNED_COLUMNS = ['name'];

type UnitTypesTableProps = {
  unitTypes: UnitTypeStats[];
  selectedName: string | null;
  /** Mean quality, performance and availability are still loading. */
  isLoadingDetails: boolean;
  onSelect: (name: string) => void;
};

export function UnitTypesTable({ unitTypes, selectedName, isLoadingDetails, onSelect }: UnitTypesTableProps) {
  const { rowHeight, headerHeight } = useTableHeights();
  const columns = useMemo(() => buildColumns(selectedName, isLoadingDetails), [selectedName, isLoadingDetails]);

  return (
    // DataGrid is virtualized: it fills its parent, which needs a size.
    <div className="h-[26rem] w-full min-w-0">
      <DataGrid
        aria-label="Statistics by unit type"
        data={unitTypes}
        columns={columns}
        getRowId={(type) => type.name}
        onRowClick={(row) => onSelect(row.original.name)}
        enableSorting
        defaultSorting={DEFAULT_SORTING}
        pinnedColumns={PINNED_COLUMNS}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
      />
    </div>
  );
}

function buildColumns(selectedName: string | null, isLoadingDetails: boolean): ColumnDef<UnitTypeStats>[] {
  return [
    {
      id: 'name',
      header: 'Unit type',
      accessorFn: (type) => type.name,
      size: 190,
      cell: ({ row }) => <SelectableName name={row.original.name} isSelected={row.original.name === selectedName} />,
    },
    { id: 'units', header: 'Units', accessorFn: (type) => type.unitCount, size: 70 },
    {
      id: 'belowAlert',
      header: 'Time below 70%',
      accessorFn: (type) => type.belowAlertShare ?? undefined,
      sortUndefined: 'last',
      size: 160,
      cell: ({ row }) => formatPercent(row.original.belowAlertShare),
    },
    {
      id: 'meanOee',
      header: 'Mean OEE',
      accessorFn: (type) => type.meanOee ?? undefined,
      sortUndefined: 'last',
      size: 100,
      cell: ({ row }) => <OeeValue ratio={row.original.meanOee} />,
    },
    percentColumn('quality', 'Quality', 90, isLoadingDetails),
    percentColumn('performance', 'Performance', 112, isLoadingDetails),
    percentColumn('availability', 'Availability', 104, isLoadingDetails),
    {
      id: 'lowestSite',
      header: 'Lowest site',
      accessorFn: (type) => type.lowestSite?.meanOee ?? undefined,
      sortUndefined: 'last',
      size: 190,
      cell: ({ row }) => {
        const lowestSite = row.original.lowestSite;
        if (lowestSite === null) return '–';
        return (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 truncate" title={lowestSite.site.name}>
              {lowestSite.site.name}
            </span>
            <OeeValue ratio={lowestSite.meanOee} />
          </span>
        );
      },
    },
  ];
}

/** A ratio column: sorted on the number, shown as a percentage. */
function percentColumn(
  metric: 'quality' | 'performance' | 'availability',
  header: string,
  size: number,
  isLoading: boolean
): ColumnDef<UnitTypeStats> {
  return {
    id: metric,
    header,
    accessorFn: (type) => type[metric] ?? undefined,
    sortUndefined: 'last',
    size,
    cell: ({ row }) => (isLoading ? <span aria-label="Loading">…</span> : formatPercent(row.original[metric])),
  };
}
