import type { CogniteClient } from '@cognite/sdk';

import { cdfTaskRunner } from '../shared/utils/semaphore';

import { getExportStep, planExport } from './oeeExport';
import type { ExportMetric, ExportSeries, ExportStepId } from './oeeExport';
import {
  ASSET_SPACE,
  DAY_MS,
  getTrendRange,
  HOUR_MS,
  OEE_ALERT_THRESHOLD,
  OEE_METRICS,
  OEE_SPACE,
} from './types';
import type {
  OeeMetric,
  Site,
  SiteUnit,
  TrendPoint,
  TrendRangeId,
  UnitComponentMeans,
  UnitOee,
  UnitOeeStats,
} from './types';

export interface OeeService {
  /** The sites: the assets without a parent. */
  listSites(): Promise<Site[]>;
  /** The assets of a site that have OEE time series, with their latest values. */
  listUnits(siteExternalId: string): Promise<UnitOee[]>;
  /**
   * Every unit of every site with its latest OEE, in two kinds of requests instead of a set per
   * site. Quality, performance and availability are not read here: they stay null.
   */
  listAllUnits(): Promise<SiteUnit[]>;
  /** Average OEE of a unit over the time frame that ends at `endMs`. */
  getOeeTrend(unitExternalId: string, endMs: number, rangeId: TrendRangeId): Promise<TrendPoint[]>;
  /** What each unit did over the time frame that ends at `endMs`: mean OEE and time below the alert threshold. */
  getUnitOeeStats(unitExternalIds: string[], endMs: number, rangeId: TrendRangeId): Promise<UnitOeeStats[]>;
  /** Mean OEE and time below the alert threshold of each unit, from hourly averages, from `startMs` to `endMs` (exclusive). */
  getUnitOeeStatsForPeriod(unitExternalIds: string[], startMs: number, endMs: number): Promise<UnitOeeStats[]>;
  /** Mean quality, performance and availability of each unit over the same time frame. */
  getUnitComponentMeans(
    unitExternalIds: string[],
    endMs: number,
    rangeId: TrendRangeId
  ): Promise<UnitComponentMeans[]>;
  /** The averages of the chosen time series of the chosen units, one per step, from `startMs` to `endMs` (exclusive). */
  /** Once `signal` aborts, no further request is sent and the promise rejects. */
  exportAverages(
    request: ExportRequest,
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<ExportSeries[]>;
}

export type ExportRequest = {
  unitExternalIds: string[];
  metrics: ExportMetric[];
  startMs: number;
  endMs: number;
  stepId: ExportStepId;
};

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
type Asset = { externalId: string; name: string; rootExternalId: string | null };
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
    return sites.map(({ externalId, name }) => ({ externalId, name })).sort(byName);
  }

  public async listUnits(siteExternalId: string): Promise<UnitOee[]> {
    const assets = await this.listAssets({
      equals: {
        property: assetProperty('root'),
        value: { space: ASSET_SPACE, externalId: siteExternalId },
      },
    });
    const latest = await this.retrieveLatest(assets, OEE_METRICS);

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

  public async listAllUnits(): Promise<SiteUnit[]> {
    const assets = await this.listAssets({ equals: { property: ['node', 'space'], value: ASSET_SPACE } });
    // A site is its own root; every other asset points to its site through `root`.
    const sites = new Map<string, Site>();
    for (const asset of assets) {
      if (asset.rootExternalId === asset.externalId) {
        sites.set(asset.externalId, { externalId: asset.externalId, name: asset.name });
      }
    }
    const candidates = assets.filter((asset) => asset.rootExternalId !== asset.externalId);
    const latest = await this.retrieveLatest(candidates, ['oee']);

    return candidates
      .flatMap((asset): SiteUnit[] => {
        const oee = latest.get(seriesExternalId(asset.externalId, 'oee'));
        const site = asset.rootExternalId === null ? undefined : sites.get(asset.rootExternalId);
        if (oee === undefined || site === undefined) return [];
        return [
          {
            site,
            unit: {
              externalId: asset.externalId,
              name: asset.name,
              oee: oee.value,
              quality: null,
              performance: null,
              availability: null,
              updatedAt: oee.timestamp,
            },
          },
        ];
      })
      .sort((a, b) => byName(a.site, b.site) || byName(a.unit, b.unit));
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

  public async getUnitOeeStats(unitExternalIds: string[], endMs: number, rangeId: TrendRangeId): Promise<UnitOeeStats[]> {
    if (unitExternalIds.length === 0) return [];
    const range = getTrendRange(rangeId);
    // OEE at the granularity of the trend, to count the periods below the alert threshold.
    const averages = await this.retrieveAverages(
      unitExternalIds.map((unit) => seriesExternalId(unit, 'oee')),
      { ...statsWindow(endMs, range.windowMs), aggregates: ['average'], granularity: range.granularity },
      range.stepMs
    );

    return toOeeStats(unitExternalIds, averages);
  }

  public async getUnitOeeStatsForPeriod(unitExternalIds: string[], startMs: number, endMs: number): Promise<UnitOeeStats[]> {
    if (unitExternalIds.length === 0 || endMs <= startMs) return [];
    const averages = await this.retrieveAverages(
      unitExternalIds.map((unit) => seriesExternalId(unit, 'oee')),
      { start: startMs, end: endMs, aggregates: ['average'], granularity: '1h' },
      HOUR_MS
    );
    return toOeeStats(unitExternalIds, averages);
  }

  public async getUnitComponentMeans(
    unitExternalIds: string[],
    endMs: number,
    rangeId: TrendRangeId
  ): Promise<UnitComponentMeans[]> {
    if (unitExternalIds.length === 0) return [];
    const range = getTrendRange(rangeId);
    // Only the mean matters here: a few large periods, weighted by their number of datapoints.
    const averages = await this.retrieveAverages(
      unitExternalIds.flatMap((unit) => COMPONENT_METRICS.map((metric) => seriesExternalId(unit, metric))),
      { ...statsWindow(endMs, range.windowMs), aggregates: ['average', 'count'], granularity: range.coarseGranularity },
      range.coarseStepMs
    );

    return unitExternalIds.map((unit) => {
      const component = (metric: OeeMetric) => weightedMean(averages.get(seriesExternalId(unit, metric)) ?? []);
      return {
        externalId: unit,
        quality: component('quality'),
        performance: component('performance'),
        availability: component('availability'),
      };
    });
  }

  public async exportAverages(
    { unitExternalIds, metrics, startMs, endMs, stepId }: ExportRequest,
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<ExportSeries[]> {
    const step = getExportStep(stepId);
    const plan = planExport(unitExternalIds.length, metrics.length, startMs, endMs, step.stepMs);
    if (plan.requests === 0) return [];

    const seriesList = unitExternalIds.flatMap((unitExternalId) =>
      metrics.map((metric): ExportSeries => ({ unitExternalId, metric, points: [] }))
    );
    const byExternalId = new Map(
      seriesList.map((series) => [`${series.unitExternalId}:${series.metric}`, series])
    );

    let done = 0;
    const requests: Promise<void>[] = [];
    for (let window = 0; window < plan.windows; window++) {
      const start = startMs + window * plan.pointsPerWindow * step.stepMs;
      const end = Math.min(endMs, start + plan.pointsPerWindow * step.stepMs);
      for (const batch of chunk(seriesList, plan.seriesPerRequest)) {
        requests.push(
          this.runner
            .schedule(async () => {
              // A cancelled export sends no further request.
              signal?.throwIfAborted();
              return this.client.datapoints.retrieve({
                items: batch.map((series) => ({
                  instanceId: { space: OEE_SPACE, externalId: `${series.unitExternalId}:${series.metric}` },
                })),
                start,
                end,
                aggregates: ['average'],
                granularity: step.granularity,
                limit: plan.pointsPerWindow,
                // A unit can lack one of its time series: unknown ids are expected.
                ignoreUnknownIds: true,
              });
            })
            .then((result) => {
              for (const retrieved of result) {
                const series = byExternalId.get(retrieved.instanceId?.externalId ?? '');
                if (series === undefined) continue;
                for (const datapoint of retrieved.datapoints) {
                  const timestamp = toMillis(datapoint.timestamp);
                  if ('average' in datapoint && typeof datapoint.average === 'number' && timestamp !== null) {
                    series.points.push({ timestamp, value: datapoint.average });
                  }
                }
              }
              done++;
              onProgress?.(done, plan.requests);
            })
        );
      }
    }
    await Promise.all(requests);
    return seriesList.filter((series) => series.points.length > 0);
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
        assets.push({
          externalId: item.externalId,
          name: readAssetName(item.properties) ?? item.externalId,
          rootExternalId: readAssetRoot(item.properties),
        });
      }
      // CDF can return a cursor with the last page: a short page is the real end.
      cursor = page.items.length < PAGE_SIZE ? undefined : page.nextCursor;
    } while (cursor !== undefined);
    return assets;
  }

  private async retrieveLatest(assets: Asset[], metrics: readonly OeeMetric[]): Promise<Map<string, LatestValue>> {
    const items = assets.flatMap((asset) =>
      metrics.map((metric) => ({
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

/** Mean OEE and periods below the alert threshold of each unit, in the order of the request. */
function toOeeStats(unitExternalIds: string[], averages: Map<string, AveragePoint[]>): UnitOeeStats[] {
  return unitExternalIds.map((unit) => {
    const oee = averages.get(seriesExternalId(unit, 'oee')) ?? [];
    return {
      externalId: unit,
      meanOee: oee.length === 0 ? null : oee.reduce((sum, point) => sum + point.average, 0) / oee.length,
      periods: oee.length,
      periodsBelowAlert: oee.filter((point) => point.average < OEE_ALERT_THRESHOLD).length,
    };
  });
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

/** Reads `properties.cdf_cdm["CogniteAsset/v1"]` from an instance. */
function readAssetProperties(properties: unknown): Record<string, unknown> | undefined {
  if (!isRecord(properties)) return undefined;
  const bySpace = properties[ASSET_VIEW.space];
  if (!isRecord(bySpace)) return undefined;
  const byView = bySpace[ASSET_VIEW_KEY];
  return isRecord(byView) ? byView : undefined;
}

function readAssetName(properties: unknown): string | undefined {
  const name = readAssetProperties(properties)?.name;
  return typeof name === 'string' && name !== '' ? name : undefined;
}

/** The external id of the root asset (the site), from the `root` direct relation. */
function readAssetRoot(properties: unknown): string | null {
  const root = readAssetProperties(properties)?.root;
  return isRecord(root) && typeof root.externalId === 'string' ? root.externalId : null;
}

/** The window of the unit statistics: whole UTC days, so every query covers the same period. */
function statsWindow(endMs: number, windowMs: number): { start: number; end: number } {
  return { start: Math.floor((endMs - windowMs) / DAY_MS) * DAY_MS, end: endMs + 1 };
}

function toMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return null;
}
