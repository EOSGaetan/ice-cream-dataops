import { DataGrid } from '@cognite/aura/data-grid';
import { IconChartLine } from '@tabler/icons-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import { formatDateTime, formatPercent } from './oeeFormat';
import { OeeValue } from './OeeValue';
import type { UnitOee } from './types';

/** Lowest OEE first: the units that need attention are at the top. */
const DEFAULT_SORTING = [{ id: 'oee', desc: false }];
const PINNED_COLUMNS = ['name'];

type UnitTableProps = {
  units: UnitOee[];
  selectedUnitId: string | null;
  onSelect: (unitId: string) => void;
};

export function UnitTable({ units, selectedUnitId, onSelect }: UnitTableProps) {
  const columns = useMemo(() => buildColumns(selectedUnitId), [selectedUnitId]);

  return (
    // DataGrid is virtualized: it fills its parent, which needs a size.
    <div className="h-96 w-full min-w-0">
      <DataGrid
        aria-label="Latest OEE by unit"
        data={units}
        columns={columns}
        getRowId={(unit) => unit.externalId}
        onRowClick={(row) => onSelect(row.original.externalId)}
        enableSorting
        defaultSorting={DEFAULT_SORTING}
        pinnedColumns={PINNED_COLUMNS}
      />
    </div>
  );
}

function buildColumns(selectedUnitId: string | null): ColumnDef<UnitOee>[] {
  return [
    {
      id: 'name',
      header: 'Unit',
      accessorFn: (unit) => unit.name,
      size: 170,
      cell: ({ row }) => (
        <UnitName name={row.original.name} isSelected={row.original.externalId === selectedUnitId} />
      ),
    },
    { id: 'externalId', header: 'External ID', accessorFn: (unit) => unit.externalId, size: 150 },
    {
      id: 'oee',
      header: 'OEE',
      accessorFn: (unit) => unit.oee ?? undefined,
      sortUndefined: 'last',
      size: 80,
      cell: ({ row }) => <OeeValue ratio={row.original.oee} />,
    },
    percentColumn('quality', 'Quality', 80),
    percentColumn('performance', 'Performance', 112),
    percentColumn('availability', 'Availability', 100),
    // Plain text column: "YYYY-MM-DD HH:mm UTC" sorts chronologically and stays on one line.
    { id: 'updatedAt', header: 'Latest value', accessorFn: (unit) => formatDateTime(unit.updatedAt), size: 180 },
  ];
}

/** A ratio column: sorted on the number, shown as a percentage. */
function percentColumn(
  metric: 'quality' | 'performance' | 'availability',
  header: string,
  size: number
): ColumnDef<UnitOee> {
  return {
    id: metric,
    header,
    accessorFn: (unit) => unit[metric] ?? undefined,
    sortUndefined: 'last',
    size,
    cell: ({ row }) => formatPercent(row.original[metric]),
  };
}

/** The unit name on one line; the row whose trend is charted is marked. */
function UnitName({ name, isSelected }: { name: string; isSelected: boolean }) {
  if (!isSelected) {
    return (
      <span className="block min-w-0 flex-1 truncate" title={name}>
        {name}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2" title={name}>
      <IconChartLine aria-hidden className="size-4 shrink-0" />
      <span className="truncate font-medium">{name}</span>
      <span className="sr-only">(selected)</span>
    </span>
  );
}
