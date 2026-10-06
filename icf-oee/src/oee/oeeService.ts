import type { CogniteClient } from '@cognite/sdk';

import { cdfTaskRunner } from '../shared/utils/semaphore';

import { ASSET_SPACE, getTrendRange, OEE_METRICS, OEE_SPACE } from './types';
import type { OeeMetric, Site, TrendPoint, TrendRangeId, UnitOee } from './types';

export interface OeeService {
  /** The sites: the assets without a parent. */
  listSites(): Promise<Site[]>;
  /** The assets of a site that have OEE time series, with their latest values. */
  listUnits(siteExternalId: string): Promise<UnitOee[]>;
  /** Average OEE of a unit over the time frame that ends at `endMs`. */
  getOeeTrend(unitExternalId: string, endMs: number, rangeId: TrendRangeId): Promise<TrendPoint[]>;
}

/** The subset of the Cognite SDK this service calls. */
export type OeeCdfClient = {
  instances: Pick<CogniteClient['instances'], 'list'>;
  datapoints: Pick<CogniteClient['datapoints'], 'retrieve' | 'retrieveLatest'>;
};

type TaskRunner = {
  schedule<T>(fn: () => Promise<T>): Promise<T>;
};

type Deps = { runner: TaskRunner };
const defaultDeps: Deps = { runner: cdfTaskRunner };

type InstanceFilter = NonNullable<Parameters<OeeCdfClient['instances']['list']>[0]['filter']>;
type Asset = { externalId: string; name: string };
type LatestValue = { value: number; timestamp: number | null };

const ASSET_VIEW = { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' } as const;
const ASSET_VIEW_KEY = 'CogniteAsset/v1';
const PAGE_SIZE = 1000;
/** `timeseries/data/latest` accepts at most 100 items per request. */
const LATEST_BATCH_SIZE = 100;

export class CdfOeeService implements OeeService {
  public constructor(
    private readonly client: OeeCdfClient,
    private readonly runner: TaskRunner
  ) {}

  public async listSites(): Promise<Site[]> {
    const sites = await this.listAssets({
      and: [
        { equals: { property: ['node', 'space'], value: ASSET_SPACE } },
        { not: { exists: { property: assetProperty('parent') } } },
      ],
    });
    return sites.sort(byName);
  }

  public async listUnits(siteExternalId: string): Promise<UnitOee[]> {
    const assets = await this.listAssets({
      equals: {
        property: assetProperty('root'),
        value: { space: ASSET_SPACE, externalId: siteExternalId },
      },
    });
    const latest = await this.retrieveLatestOee(assets);

    return assets
      .flatMap((asset): UnitOee[] => {
        const read = (metric: OeeMetric) => latest.get(seriesExternalId(asset.externalId, metric));
        if (!OEE_METRICS.some((metric) => read(metric) !== undefined)) return [];
        return [
          {
            externalId: asset.externalId,
            name: asset.name,
            oee: read('oee')?.value ?? null,
            quality: read('quality')?.value ?? null,
            performance: read('performance')?.value ?? null,
            availability: read('availability')?.value ?? null,
            updatedAt: read('oee')?.timestamp ?? null,
          },
        ];
      })
      .sort(byName);
  }

  public async getOeeTrend(unitExternalId: string, endMs: number, rangeId: TrendRangeId): Promise<TrendPoint[]> {
    const range = getTrendRange(rangeId);
    const result = await this.runner.schedule(() =>
      this.client.datapoints.retrieve({
        items: [{ instanceId: { space: OEE_SPACE, externalId: seriesExternalId(unitExternalId, 'oee') } }],
        start: endMs - range.windowMs,
        // `end` is exclusive: add 1 ms to keep the period of the latest datapoint.
        end: endMs + 1,
        aggregates: ['average'],
        granularity: range.granularity,
        limit: 1000,
      })
    );

    const points: TrendPoint[] = [];
    for (const series of result) {
      for (const datapoint of series.datapoints) {
        const timestamp = toMillis(datapoint.timestamp);
        if ('average' in datapoint && typeof datapoint.average === 'number' && timestamp !== null) {
          points.push({ timestamp, oee: datapoint.average });
        }
      }
    }
    return points;
  }

  private async listAssets(filter: InstanceFilter): Promise<Asset[]> {
    const assets: Asset[] = [];
    let cursor: string | undefined;
    do {
      const pageCursor = cursor;
      const page = await this.runner.schedule(() =>
        this.client.instances.list({
          instanceType: 'node',
          sources: [{ source: ASSET_VIEW }],
          filter,
          limit: PAGE_SIZE,
          cursor: pageCursor,
        })
      );
      for (const item of page.items) {
        assets.push({ externalId: item.externalId, name: readAssetName(item.properties) ?? item.externalId });
      }
      // CDF can return a cursor with the last page: a short page is the real end.
      cursor = page.items.length < PAGE_SIZE ? undefined : page.nextCursor;
    } while (cursor !== undefined);
    return assets;
  }

  private async retrieveLatestOee(assets: Asset[]): Promise<Map<string, LatestValue>> {
    const items = assets.flatMap((asset) =>
      OEE_METRICS.map((metric) => ({
        instanceId: { space: OEE_SPACE, externalId: seriesExternalId(asset.externalId, metric) },
      }))
    );
    // Assets that are not units have no OEE time series: unknown ids are expected.
    const batches = await Promise.all(
      chunk(items, LATEST_BATCH_SIZE).map((batch) =>
        this.runner.schedule(() => this.client.datapoints.retrieveLatest(batch, { ignoreUnknownIds: true }))
      )
    );

    const latest = new Map<string, LatestValue>();
    for (const series of batches.flat()) {
      const externalId = series.instanceId?.externalId;
      if (externalId === undefined || series.datapoints.length === 0) continue;
      const datapoint = series.datapoints[0];
      if (typeof datapoint.value !== 'number') continue;
      latest.set(externalId, { value: datapoint.value, timestamp: toMillis(datapoint.timestamp) });
    }
    return latest;
  }
}

export function createOeeService(client: OeeCdfClient, overrides?: Partial<Deps>): OeeService {
  const { runner } = { ...defaultDeps, ...overrides };
  return new CdfOeeService(client, runner);
}

function assetProperty(name: string): string[] {
  return ['cdf_cdm', ASSET_VIEW_KEY, name];
}

function seriesExternalId(assetExternalId: string, metric: OeeMetric): string {
  return `${assetExternalId}:${metric}`;
}

function byName(a: { name: string; externalId: string }, b: { name: string; externalId: string }): number {
  return a.name.localeCompare(b.name) || a.externalId.localeCompare(b.externalId);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Reads `properties.cdf_cdm["CogniteAsset/v1"].name` from an instance. */
function readAssetName(properties: unknown): string | undefined {
  if (!isRecord(properties)) return undefined;
  const bySpace = properties[ASSET_VIEW.space];
  if (!isRecord(bySpace)) return undefined;
  const byView = bySpace[ASSET_VIEW_KEY];
  if (!isRecord(byView)) return undefined;
  const name = byView.name;
  return typeof name === 'string' && name !== '' ? name : undefined;
}

function toMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return null;
}
