import type { CogniteClient } from '@cognite/sdk';

import { cdfTaskRunner } from '../shared/utils/semaphore';

import { ASSET_SPACE, DAY_MS, getTrendRange, OEE_ALERT_THRESHOLD, OEE_METRICS, OEE_SPACE } from './types';
import type { OeeMetric, Site, TrendPoint, TrendRangeId, UnitOee, UnitPeriodStats } from './types';

export interface OeeService {
  /** The sites: the assets without a parent. */
  listSites(): Promise<Site[]>;
  /** The assets of a site that have OEE time series, with their latest values. */
  listUnits(siteExternalId: string): Promise<UnitOee[]>;
  /** Average OEE of a unit over the time frame that ends at `endMs`. */
  getOeeTrend(unitExternalId: string, endMs: number, rangeId: TrendRangeId): Promise<TrendPoint[]>;
  /** What each unit did over the time frame that ends at `endMs`: mean OEE, time below the alert threshold, mean quality, performance and availability. */
  getUnitPeriodStats(unitExternalIds: string[], endMs: number, rangeId: TrendRangeId): Promise<UnitPeriodStats[]>;
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
type RetrieveQuery = Parameters<OeeCdfClient['datapoints']['retrieve']>[0];
type AveragePoint = { average: number; count: number | null };

const ASSET_VIEW = { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' } as const;
const ASSET_VIEW_KEY = 'CogniteAsset/v1';
const PAGE_SIZE = 1000;
/** `timeseries/data/latest` accepts at most 100 items per request. */
const LATEST_BATCH_SIZE = 100;
/** `timeseries/data/list` accepts at most 100 time series and 10 000 aggregates per request. */
const RETRIEVE_MAX_ITEMS = 100;
const RETRIEVE_MAX_AGGREGATES = 10000;
const COMPONENT_METRICS = ['quality', 'performance', 'availability'] as const;

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

  public async getUnitPeriodStats(
    unitExternalIds: string[],
    endMs: number,
    rangeId: TrendRangeId
  ): Promise<UnitPeriodStats[]> {
    if (unitExternalIds.length === 0) return [];
    const range = getTrendRange(rangeId);
    // Whole UTC days, so the fine and the coarse averages cover the same window.
    const start = Math.floor((endMs - range.windowMs) / DAY_MS) * DAY_MS;
    const end = endMs + 1;

    const [oeeAverages, componentAverages] = await Promise.all([
      // OEE at the granularity of the trend, to count the periods below the alert threshold.
      this.retrieveAverages(
        unitExternalIds.map((unit) => seriesExternalId(unit, 'oee')),
        { start, end, aggregates: ['average'], granularity: range.granularity },
        range.stepMs
      ),
      // Quality, performance and availability only need their mean: a few large periods.
      this.retrieveAverages(
        unitExternalIds.flatMap((unit) => COMPONENT_METRICS.map((metric) => seriesExternalId(unit, metric))),
        { start, end, aggregates: ['average', 'count'], granularity: range.coarseGranularity },
        range.coarseStepMs
      ),
    ]);

    return unitExternalIds.map((unit) => {
      const oee = oeeAverages.get(seriesExternalId(unit, 'oee')) ?? [];
      const component = (metric: OeeMetric) => weightedMean(componentAverages.get(seriesExternalId(unit, metric)) ?? []);
      return {
        externalId: unit,
        meanOee: oee.length === 0 ? null : oee.reduce((sum, point) => sum + point.average, 0) / oee.length,
        periods: oee.length,
        periodsBelowAlert: oee.filter((point) => point.average < OEE_ALERT_THRESHOLD).length,
        quality: component('quality'),
        performance: component('performance'),
        availability: component('availability'),
      };
    });
  }

  /** Averages of many OEE-space time series, in as few requests as the API limits allow. */
  private async retrieveAverages(
    seriesExternalIds: string[],
    query: Pick<RetrieveQuery, 'start' | 'end' | 'aggregates' | 'granularity'> & { start: number; end: number },
    stepMs: number
  ): Promise<Map<string, AveragePoint[]>> {
    const pointsPerSeries = Math.ceil((query.end - query.start) / stepMs) + 1;
    const batchSize = Math.max(1, Math.min(RETRIEVE_MAX_ITEMS, Math.floor(RETRIEVE_MAX_AGGREGATES / pointsPerSeries)));
    const batches = await Promise.all(
      chunk(seriesExternalIds, batchSize).map((batch) =>
        this.runner.schedule(() =>
          this.client.datapoints.retrieve({
            ...query,
            items: batch.map((externalId) => ({ instanceId: { space: OEE_SPACE, externalId } })),
            limit: pointsPerSeries,
            // A unit can lack one of its time series: unknown ids are expected.
            ignoreUnknownIds: true,
          })
        )
      )
    );

    const averages = new Map<string, AveragePoint[]>();
    for (const batch of batches) {
      for (const series of batch) {
        const externalId = series.instanceId?.externalId;
        if (externalId === undefined) continue;
        const points: AveragePoint[] = [];
        for (const datapoint of series.datapoints) {
          if ('average' in datapoint && typeof datapoint.average === 'number') {
            points.push({ average: datapoint.average, count: typeof datapoint.count === 'number' ? datapoint.count : null });
          }
        }
        averages.set(externalId, points);
      }
    }
    return averages;
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

/** Mean of period averages, each weighted by its number of datapoints. */
function weightedMean(points: AveragePoint[]): number | null {
  let total = 0;
  let weight = 0;
  for (const point of points) {
    const pointWeight = point.count ?? 1;
    total += point.average * pointWeight;
    weight += pointWeight;
  }
  return weight === 0 ? null : total / weight;
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
