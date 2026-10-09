import { Card, CardContent } from '@cognite/aura/components/card';
import type { ReactNode } from 'react';

import type { SiteSummary } from './oeeKpi';
import { OeeValue } from './OeeValue';
import { SiteOeeValue } from './SiteOeeValue';

type SiteKpiTilesProps = {
  summary: SiteSummary;
};

export function SiteKpiTiles({ summary }: SiteKpiTilesProps) {
  const { unitCount, meanOee, belowAlertCount, lowestUnit } = summary;

  return (
    <section aria-label="Site summary" className="grid grid-cols-12 gap-4">
      <Tile label="Site OEE" hint="Mean of the latest OEE of the units">
        <SiteOeeValue ratio={meanOee} />
      </Tile>
      <Tile label="Units" hint="With OEE time series">
        {unitCount}
      </Tile>
      <Tile label="Units below 70%" hint={belowAlertCount === 0 ? 'No unit under the alert threshold' : 'Under the alert threshold'}>
        {belowAlertCount}
      </Tile>
      <Tile label="Lowest unit" hint={lowestUnit ? `${lowestUnit.name} (${lowestUnit.externalId})` : 'No OEE value'}>
        <OeeValue ratio={lowestUnit?.oee ?? null} />
      </Tile>
    </section>
  );
}

type TileProps = {
  label: string;
  hint: string;
  children: ReactNode;
};

function Tile({ label, hint, children }: TileProps) {
  return (
    <div className="col-span-12 sm:col-span-6 lg:col-span-3">
      <Card>
        <CardContent>
          <div className="flex w-full min-w-0 flex-col gap-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="flex h-9 items-center text-3xl font-medium text-foreground">{children}</span>
            <span className="truncate text-sm text-muted-foreground" title={hint}>
              {hint}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
