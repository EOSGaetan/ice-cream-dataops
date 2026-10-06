import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@cognite/aura/chart';
import type { ChartConfig } from '@cognite/aura/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { formatPercent } from './oeeFormat';
import type { UnitTypeStats } from './unitTypes';

const CHART_CONFIG: ChartConfig = {
  share: { label: 'Time below 70%', color: 'var(--chart-fjord-color-1)' },
};

type UnitTypesChartProps = {
  /** The unit types to chart, already in ranking order. */
  unitTypes: UnitTypeStats[];
};

/** Ranking of the unit types by the share of the time they spend below the alert threshold. */
export function UnitTypesChart({ unitTypes }: UnitTypesChartProps) {
  const rows = unitTypes.map((type) => ({ name: type.name, share: type.belowAlertShare ?? 0 }));
  // Round the axis up to the next 10%, so its last tick is a round value.
  const axisMax = Math.max(0.1, Math.ceil(Math.max(...rows.map((row) => row.share)) * 10) / 10);

  return (
    <div className="h-80 w-full min-w-0">
      <ChartContainer
        config={CHART_CONFIG}
        aria-label={`Share of the time below 70% OEE for the ${rows.length} most problematic unit types`}
        className="h-full w-full"
      >
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" domain={[0, axisMax]} tickFormatter={formatAxisPercent} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={220} tickLine={false} axisLine={false} interval={0} />
          <ChartTooltip
            content={
              <ChartTooltipContent valueFormatter={(value) => (typeof value === 'number' ? formatPercent(value) : value)} />
            }
          />
          <Bar dataKey="share" fill="var(--color-share)" radius={4} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function formatAxisPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
