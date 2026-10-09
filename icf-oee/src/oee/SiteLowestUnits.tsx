import { OeeValue } from './OeeValue';
import { SiteOeeValue } from './SiteOeeValue';
import type { SiteOverview } from './useOeeViewModel';

type SiteLowestUnitsProps = {
  overview: SiteOverview;
};

/** The content of the map hover card: the site OEE and its units with the lowest OEE. */
export function SiteLowestUnits({ overview }: SiteLowestUnitsProps) {
  const { site, summary, lowestUnits, isLoading, error } = overview;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{site.name}</span>
        {summary !== null && <SiteOeeValue ratio={summary.meanOee} />}
      </div>
      {isLoading && <span className="text-muted-foreground">Loading units…</span>}
      {error !== null && <span className="text-muted-foreground">{error}</span>}
      {summary !== null && lowestUnits.length === 0 && (
        <span className="text-muted-foreground">No unit with an OEE value.</span>
      )}
      {lowestUnits.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground">Lowest OEE</span>
          <ol className="flex flex-col gap-2">
            {lowestUnits.map((unit) => (
              <li key={unit.externalId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate" title={`${unit.name} (${unit.externalId})`}>
                  {unit.name}
                </span>
                <OeeValue ratio={unit.oee} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
