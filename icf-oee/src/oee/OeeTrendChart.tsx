import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@cognite/aura/chart';
import type { ChartConfig } from '@cognite/aura/chart';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';

import { formatDateTime, formatPercent } from './oeeFormat';
import { OEE_ALERT_THRESHOLD } from './types';
import type { TrendPoint } from './types';

const CHART_CONFIG: ChartConfig = {
  oee: { label: 'OEE', color: 'var(--chart-fjord-color-1)' },
};

type OeeTrendChartProps = {
  unitName: string;
  points: TrendPoint[];
};

export function OeeTrendChart({ unitName, points }: OeeTrendChartProps) {
  return (
    <div className="h-80 w-full min-w-0">
      <ChartContainer
        config={CHART_CONFIG}
        aria-label={`Hourly average OEE of ${unitName}, with the ${formatAxisPercent(OEE_ALERT_THRESHOLD)} alert threshold`}
        className="h-full w-full"
      >
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTick}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
          />
          <YAxis domain={[0, 1]} tickFormatter={formatAxisPercent} tickLine={false} axisLine={false} width={48} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_label, payload) => formatDateTime(readTimestamp(payload[0]?.payload))}
                valueFormatter={(value) => (typeof value === 'number' ? formatPercent(value) : value)}
              />
            }
          />
          <ReferenceLine
            y={OEE_ALERT_THRESHOLD}
            stroke="var(--chart-destructive-color-1)"
            strokeDasharray="6 4"
            ifOverflow="extendDomain"
          />
          {/* Straight segments: a smoothed curve would draw slopes that are not in the data. */}
          <Line dataKey="oee" type="linear" stroke="var(--color-oee)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function formatAxisPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** "10-04" (month-day, UTC) */
function formatTick(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(5, 10);
}

function readTimestamp(payload: Record<string, unknown> | undefined): number | null {
  const timestamp = payload?.timestamp;
  return typeof timestamp === 'number' ? timestamp : null;
}
