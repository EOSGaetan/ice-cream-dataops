import { DataGrid } from '@cognite/aura/data-grid';
import type { ColumnDef } from '@tanstack/react-table';

import { useTableHeights } from './oeeDeps';
import { formatPercent } from './oeeFormat';
import { OeeValue } from './OeeValue';
import { belowAlertShare } from './unitTypes';
import type { UnitTypeMember } from './unitTypes';

const PINNED_COLUMNS = ['site'];

const COLUMNS: ColumnDef<UnitTypeMember>[] = [
  { id: 'site', header: 'Site', accessorFn: (member) => member.site.name, size: 130 },
  { id: 'unit', header: 'Unit', accessorFn: (member) => member.unit.externalId, size: 150 },
  {
    id: 'meanOee',
    header: 'Mean OEE',
    accessorFn: (member) => member.stats?.meanOee ?? undefined,
    sortUndefined: 'last',
    size: 100,
    cell: ({ row }) => <OeeValue ratio={row.original.stats?.meanOee ?? null} />,
  },
  {
    id: 'belowAlert',
    header: 'Below 70%',
    accessorFn: (member) => belowAlertShare(member.stats) ?? undefined,
    sortUndefined: 'last',
    size: 100,
    cell: ({ row }) => formatPercent(belowAlertShare(row.original.stats)),
  },
];

type UnitTypeDetailProps = {
  /** The units of the selected type, lowest mean OEE first. */
  members: UnitTypeMember[];
  onOpenUnit: (siteId: string, unitId: string) => void;
};

/** The units of one type, site by site. */
export function UnitTypeDetail({ members, onOpenUnit }: UnitTypeDetailProps) {
  const { rowHeight, headerHeight } = useTableHeights();
  return (
    // DataGrid is virtualized: it fills its parent, which needs a size.
    <div className="h-[26rem] w-full min-w-0">
      <DataGrid
        aria-label="Units of the selected type"
        data={members}
        columns={COLUMNS}
        getRowId={(member) => member.unit.externalId}
        onRowClick={(row) => onOpenUnit(row.original.site.externalId, row.original.unit.externalId)}
        enableSorting
        pinnedColumns={PINNED_COLUMNS}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
      />
    </div>
  );
}
