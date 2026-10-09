import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CdfOeeService, createOeeService } from './oeeService';
import type { OeeCdfClient, OeeService } from './oeeService';

type ListResponse = Awaited<ReturnType<OeeCdfClient['instances']['list']>>;
type LatestResponse = Awaited<ReturnType<OeeCdfClient['datapoints']['retrieveLatest']>>;
type RetrieveResponse = Awaited<ReturnType<OeeCdfClient['datapoints']['retrieve']>>;

const UPDATED_AT = Date.UTC(2026, 9, 4, 12, 0);

describe(CdfOeeService.name, () => {
  let list: ReturnType<typeof vi.fn<OeeCdfClient['instances']['list']>>;
  let retrieve: ReturnType<typeof vi.fn<OeeCdfClient['datapoints']['retrieve']>>;
  let retrieveLatest: ReturnType<typeof vi.fn<OeeCdfClient['datapoints']['retrieveLatest']>>;
  let service: OeeService;

  beforeEach(() => {
    list = vi.fn<OeeCdfClient['instances']['list']>();
    retrieve = vi.fn<OeeCdfClient['datapoints']['retrieve']>();
    retrieveLatest = vi.fn<OeeCdfClient['datapoints']['retrieveLatest']>();
    service = createOeeService(
      { instances: { list }, datapoints: { retrieve, retrieveLatest } },
      { runner: { schedule: (fn) => fn() } }
    );
  });

  describe('listSites', () => {
    it('asks for the assets of the asset space that have no parent', async () => {
      list.mockResolvedValue(makePage([]));

      await service.listSites();

      expect(list).toHaveBeenCalledWith({
        instanceType: 'node',
        sources: [{ source: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' } }],
        filter: {
          and: [
            { equals: { property: ['node', 'space'], value: 'icapi_dm_space' } },
            { not: { exists: { property: ['cdf_cdm', 'CogniteAsset/v1', 'parent'] } } },
          ],
        },
        limit: 1000,
        cursor: undefined,
      });
    });

    it('returns the sites sorted by name, with the external id as fallback name', async () => {
      list.mockResolvedValue(makePage([makeAsset('oslo', 'Oslo'), makeAsset('houston', 'Houston'), makeAsset('x')]));

      await expect(service.listSites()).resolves.toEqual([
        { externalId: 'houston', name: 'Houston' },
        { externalId: 'oslo', name: 'Oslo' },
        { externalId: 'x', name: 'x' },
      ]);
    });

    it('stops at a short page even when CDF returns a cursor', async () => {
      list.mockResolvedValue(makePage([makeAsset('oslo', 'Oslo')], 'cursor-after-last-page'));

      await service.listSites();

      expect(list).toHaveBeenCalledTimes(1);
    });

    it('follows the cursor after a full page', async () => {
      const fullPage = Array.from({ length: 1000 }, (_, index) => makeAsset(`a${index}`, `Asset ${index}`));
      list.mockResolvedValueOnce(makePage(fullPage, 'next')).mockResolvedValueOnce(makePage([makeAsset('last', 'Last')]));

      const sites = await service.listSites();

      expect(sites).toHaveLength(1001);
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next' }));
    });

    it('rejects when CDF fails', async () => {
      list.mockRejectedValue(new Error('403'));

      await expect(service.listSites()).rejects.toThrow('403');
    });
  });

  describe('listUnits', () => {
    it('asks for the assets whose root is the site', async () => {
      list.mockResolvedValue(makePage([]));

      await service.listUnits('oslo');

      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            equals: {
              property: ['cdf_cdm', 'CogniteAsset/v1', 'root'],
              value: { space: 'icapi_dm_space', externalId: 'oslo' },
            },
          },
        })
      );
      expect(retrieveLatest).not.toHaveBeenCalled();
    });

    it('asks for the latest value of the four OEE time series of each asset', async () => {
      list.mockResolvedValue(makePage([makeAsset('U1', 'Unit 1')]));
      retrieveLatest.mockResolvedValue([]);

      await service.listUnits('oslo');

      expect(retrieveLatest).toHaveBeenCalledWith(
        [
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:oee' } },
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:quality' } },
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:performance' } },
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:availability' } },
        ],
        { ignoreUnknownIds: true }
      );
    });

    it('keeps only the assets that have OEE values, sorted by name', async () => {
      list.mockResolvedValue(makePage([makeAsset('oslo', 'Oslo'), makeAsset('U2', 'Tank'), makeAsset('U1', 'Mixer')]));
      retrieveLatest.mockResolvedValue([
        makeLatest('U2:oee', 0.5),
        makeLatest('U1:oee', 0.75),
        makeLatest('U1:quality', 0.9),
        makeLatest('U1:performance', 0.95),
        makeLatest('U1:availability', 1),
      ]);

      await expect(service.listUnits('oslo')).resolves.toEqual([
        {
          externalId: 'U1',
          name: 'Mixer',
          oee: 0.75,
          quality: 0.9,
          performance: 0.95,
          availability: 1,
          updatedAt: UPDATED_AT,
        },
        {
          externalId: 'U2',
          name: 'Tank',
          oee: 0.5,
          quality: null,
          performance: null,
          availability: null,
          updatedAt: UPDATED_AT,
        },
      ]);
    });

    it('sends at most 100 time series per request', async () => {
      const assets = Array.from({ length: 30 }, (_, index) => makeAsset(`U${index}`, `Unit ${index}`));
      list.mockResolvedValue(makePage(assets));
      retrieveLatest.mockResolvedValue([]);

      await service.listUnits('oslo');

      expect(retrieveLatest.mock.calls.map(([items]) => items.length)).toEqual([100, 20]);
    });

    it('rejects when the datapoints request fails', async () => {
      list.mockResolvedValue(makePage([makeAsset('U1', 'Unit 1')]));
      retrieveLatest.mockRejectedValue(new Error('429'));

      await expect(service.listUnits('oslo')).rejects.toThrow('429');
    });
  });

  describe('listAllUnits', () => {
    it('reads the assets of the asset space once, then only the latest OEE of the assets that are not sites', async () => {
      list.mockResolvedValue(makePage([makeAsset('oslo', 'Oslo', 'oslo'), makeAsset('U1', 'Mixer', 'oslo')]));
      retrieveLatest.mockResolvedValue([]);

      await service.listAllUnits();

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenCalledWith({
        instanceType: 'node',
        sources: [{ source: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' } }],
        filter: { equals: { property: ['node', 'space'], value: 'icapi_dm_space' } },
        limit: 1000,
        cursor: undefined,
      });
      expect(retrieveLatest).toHaveBeenCalledTimes(1);
      expect(retrieveLatest).toHaveBeenCalledWith([{ instanceId: { space: 'oee_ts_space', externalId: 'U1:oee' } }], {
        ignoreUnknownIds: true,
      });
    });

    it('returns the units that have an OEE value with their site, sorted by site then by unit', async () => {
      list.mockResolvedValue(
        makePage([
          makeAsset('oslo', 'Oslo', 'oslo'),
          makeAsset('houston', 'Houston', 'houston'),
          makeAsset('O2', 'Tank', 'oslo'),
          makeAsset('O1', 'Mixer', 'oslo'),
          makeAsset('H1', 'Tank', 'houston'),
          makeAsset('line', 'Line without OEE', 'oslo'),
          makeAsset('orphan', 'Unit of an unknown site', 'unknown'),
          makeAsset('rootless', 'Unit without root'),
        ])
      );
      retrieveLatest.mockResolvedValue([
        makeLatest('O1:oee', 0.75),
        makeLatest('O2:oee', 0.5),
        makeLatest('H1:oee', 0.9),
        makeLatest('orphan:oee', 0.9),
        makeLatest('rootless:oee', 0.9),
      ]);

      const units = await service.listAllUnits();

      expect(units.map(({ site, unit }) => `${site.name} / ${unit.name}`)).toEqual([
        'Houston / Tank',
        'Oslo / Mixer',
        'Oslo / Tank',
      ]);
      expect(units[1]).toEqual({
        site: { externalId: 'oslo', name: 'Oslo' },
        unit: {
          externalId: 'O1',
          name: 'Mixer',
          oee: 0.75,
          quality: null,
          performance: null,
          availability: null,
          updatedAt: UPDATED_AT,
        },
      });
    });

    it('sends at most 100 time series per request', async () => {
      const assets = Array.from({ length: 250 }, (_, index) => makeAsset(`U${index}`, `Unit ${index}`, 'oslo'));
      list.mockResolvedValue(makePage([makeAsset('oslo', 'Oslo', 'oslo'), ...assets]));
      retrieveLatest.mockResolvedValue([]);

      await service.listAllUnits();

      expect(retrieveLatest.mock.calls.map(([items]) => items.length)).toEqual([100, 100, 50]);
    });

    it('rejects when CDF fails', async () => {
      list.mockRejectedValue(new Error('403'));

      await expect(service.listAllUnits()).rejects.toThrow('403');
    });
  });

  describe('getOeeTrend', () => {
    it.each([
      { range: '1m', days: 30, granularity: '4h' },
      { range: '1y', days: 365, granularity: '1d' },
    ] as const)('asks for $granularity averages over $days days for the $range time frame', async ({ range, days, granularity }) => {
      retrieve.mockResolvedValue([]);

      await service.getOeeTrend('U1', UPDATED_AT, range);

      expect(retrieve).toHaveBeenCalledWith(
        expect.objectContaining({ start: UPDATED_AT - days * 24 * 60 * 60 * 1000, end: UPDATED_AT + 1, granularity })
      );
    });

    it('asks for the hourly average over the 7 days that end at the given time', async () => {
      retrieve.mockResolvedValue([]);

      await service.getOeeTrend('U1', UPDATED_AT, '1w');

      expect(retrieve).toHaveBeenCalledWith({
        items: [{ instanceId: { space: 'oee_ts_space', externalId: 'U1:oee' } }],
        start: UPDATED_AT - 7 * 24 * 60 * 60 * 1000,
        end: UPDATED_AT + 1,
        aggregates: ['average'],
        granularity: '1h',
        limit: 1000,
      });
    });

    it('returns one point per hourly average', async () => {
      const aggregates: RetrieveResponse = [
        {
          id: 1,
          isString: false,
          isStep: false,
          datapoints: [
            { timestamp: new Date(UPDATED_AT - 3600000), average: 0.4 },
            { timestamp: new Date(UPDATED_AT), average: 0.8 },
            { timestamp: new Date(UPDATED_AT + 3600000) },
          ],
        },
      ];
      retrieve.mockResolvedValue(aggregates);

      await expect(service.getOeeTrend('U1', UPDATED_AT, '1w')).resolves.toEqual([
        { timestamp: UPDATED_AT - 3600000, oee: 0.4 },
        { timestamp: UPDATED_AT, oee: 0.8 },
      ]);
    });

    it('returns no point when the time series is empty', async () => {
      retrieve.mockResolvedValue([]);

      await expect(service.getOeeTrend('U1', UPDATED_AT, '1w')).resolves.toEqual([]);
    });

    it('rejects when CDF fails', async () => {
      retrieve.mockRejectedValue(new Error('500'));

      await expect(service.getOeeTrend('U1', UPDATED_AT, '1w')).rejects.toThrow('500');
    });
  });
});

describe('CdfOeeService unit statistics', () => {
  // 2026-10-04 12:00 UTC: the 7-day window starts at 2026-09-27 00:00 UTC (whole UTC days).
  const WEEK_START = Date.UTC(2026, 8, 27);
  let retrieve: ReturnType<typeof vi.fn<OeeCdfClient['datapoints']['retrieve']>>;
  let service: OeeService;

  beforeEach(() => {
    retrieve = vi.fn<OeeCdfClient['datapoints']['retrieve']>();
    retrieve.mockResolvedValue([]);
    service = createOeeService(
      {
        instances: { list: vi.fn<OeeCdfClient['instances']['list']>() },
        datapoints: { retrieve, retrieveLatest: vi.fn<OeeCdfClient['datapoints']['retrieveLatest']>() },
      },
      { runner: { schedule: (fn) => fn() } }
    );
  });

  describe('getUnitOeeStats', () => {
    it('asks nothing for no unit', async () => {
      await expect(service.getUnitOeeStats([], UPDATED_AT, '1w')).resolves.toEqual([]);
      expect(retrieve).not.toHaveBeenCalled();
    });

    it('asks only for the OEE, at the granularity of the time frame, over whole days', async () => {
      await service.getUnitOeeStats(['U1', 'U2'], UPDATED_AT, '1w');

      expect(retrieve).toHaveBeenCalledTimes(1);
      expect(retrieve).toHaveBeenCalledWith({
        items: [
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:oee' } },
          { instanceId: { space: 'oee_ts_space', externalId: 'U2:oee' } },
        ],
        start: WEEK_START,
        end: UPDATED_AT + 1,
        aggregates: ['average'],
        granularity: '1h',
        // 7.5 days of hourly averages, plus one.
        limit: 182,
        ignoreUnknownIds: true,
      });
    });

    it.each([
      { range: '1m', days: 30, granularity: '4h' },
      { range: '1y', days: 365, granularity: '1d' },
    ] as const)('uses $granularity averages for the $range time frame', async ({ range, days, granularity }) => {
      await service.getUnitOeeStats(['U1'], UPDATED_AT, range);

      const start = Date.UTC(2026, 9, 4) - days * 24 * 60 * 60 * 1000;
      expect(retrieve).toHaveBeenCalledWith(expect.objectContaining({ start, granularity, aggregates: ['average'] }));
    });

    it('stays under 100 time series and 10 000 aggregates per request', async () => {
      const units = Array.from({ length: 120 }, (_, index) => `U${index}`);

      await service.getUnitOeeStats(units, UPDATED_AT, '1w');

      const calls = retrieve.mock.calls.map(([query]) => ({
        items: query.items.length,
        aggregates: query.items.length * (query.limit ?? 0),
      }));
      // 182 hourly averages per unit, so 54 units per request.
      expect(calls.map((call) => call.items)).toEqual([54, 54, 12]);
      expect(calls.every((call) => call.items <= 100 && call.aggregates <= 10000)).toBe(true);
    });

    it('computes the mean OEE and the periods below the alert threshold', async () => {
      retrieve.mockResolvedValue([makeAggregates('U1:oee', [{ average: 0.9 }, { average: 0.5 }, { average: 0.4 }])]);

      const [stats] = await service.getUnitOeeStats(['U1'], UPDATED_AT, '1w');

      expect(stats.externalId).toBe('U1');
      expect(stats.meanOee).toBeCloseTo(0.6);
      expect(stats.periods).toBe(3);
      expect(stats.periodsBelowAlert).toBe(2);
    });

    it('returns empty statistics for a unit without datapoints, in the order of the request', async () => {
      retrieve.mockResolvedValue([makeAggregates('U2:oee', [{ average: 0.8 }])]);

      await expect(service.getUnitOeeStats(['U1', 'U2'], UPDATED_AT, '1w')).resolves.toEqual([
        { externalId: 'U1', meanOee: null, periods: 0, periodsBelowAlert: 0 },
        { externalId: 'U2', meanOee: 0.8, periods: 1, periodsBelowAlert: 0 },
      ]);
    });

    it('rejects when CDF fails', async () => {
      retrieve.mockRejectedValue(new Error('429'));

      await expect(service.getUnitOeeStats(['U1'], UPDATED_AT, '1w')).rejects.toThrow('429');
    });
  });

  describe('getUnitComponentMeans', () => {
    it('asks nothing for no unit', async () => {
      await expect(service.getUnitComponentMeans([], UPDATED_AT, '1w')).resolves.toEqual([]);
      expect(retrieve).not.toHaveBeenCalled();
    });

    it('asks for the mean quality, performance and availability with a few large periods', async () => {
      await service.getUnitComponentMeans(['U1'], UPDATED_AT, '1w');

      expect(retrieve).toHaveBeenCalledTimes(1);
      expect(retrieve).toHaveBeenCalledWith({
        items: [
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:quality' } },
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:performance' } },
          { instanceId: { space: 'oee_ts_space', externalId: 'U1:availability' } },
        ],
        start: WEEK_START,
        end: UPDATED_AT + 1,
        aggregates: ['average', 'count'],
        granularity: '1d',
        limit: 9,
        ignoreUnknownIds: true,
      });
    });

    it.each([
      { range: '1m', days: 30, coarse: '1d' },
      { range: '1y', days: 365, coarse: '30d' },
    ] as const)('uses $coarse averages for the $range time frame', async ({ range, days, coarse }) => {
      await service.getUnitComponentMeans(['U1'], UPDATED_AT, range);

      const start = Date.UTC(2026, 9, 4) - days * 24 * 60 * 60 * 1000;
      expect(retrieve).toHaveBeenCalledWith(
        expect.objectContaining({ start, granularity: coarse, aggregates: ['average', 'count'] })
      );
    });

    it('sends at most 100 time series per request', async () => {
      const units = Array.from({ length: 120 }, (_, index) => `U${index}`);

      await service.getUnitComponentMeans(units, UPDATED_AT, '1w');

      // 360 time series.
      expect(retrieve.mock.calls.map(([query]) => query.items.length)).toEqual([100, 100, 100, 60]);
    });

    it('weights the mean of each ratio by the number of datapoints of its periods', async () => {
      retrieve.mockResolvedValue([
        makeAggregates('U1:quality', [
          { average: 1, count: 300 },
          { average: 0.6, count: 100 },
        ]),
        makeAggregates('U1:performance', [{ average: 0.8, count: 10 }]),
      ]);

      const means = await service.getUnitComponentMeans(['U1', 'U2'], UPDATED_AT, '1w');

      expect(means[0].externalId).toBe('U1');
      expect(means[0].quality).toBeCloseTo(0.9);
      expect(means[0].performance).toBeCloseTo(0.8);
      expect(means[0].availability).toBeNull();
      expect(means[1]).toEqual({ externalId: 'U2', quality: null, performance: null, availability: null });
    });

    it('rejects when CDF fails', async () => {
      retrieve.mockRejectedValue(new Error('429'));

      await expect(service.getUnitComponentMeans(['U1'], UPDATED_AT, '1w')).rejects.toThrow('429');
    });
  });
});

describe('CdfOeeService.exportAverages', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const MINUTE = 60 * 1000;
  const START = Date.UTC(2026, 9, 4);
  let retrieve: ReturnType<typeof vi.fn<OeeCdfClient['datapoints']['retrieve']>>;
  let service: OeeService;

  beforeEach(() => {
    retrieve = vi.fn<OeeCdfClient['datapoints']['retrieve']>();
    retrieve.mockResolvedValue([]);
    service = createOeeService(
      {
        instances: { list: vi.fn<OeeCdfClient['instances']['list']>() },
        datapoints: { retrieve, retrieveLatest: vi.fn<OeeCdfClient['datapoints']['retrieveLatest']>() },
      },
      { runner: { schedule: (fn) => fn() } }
    );
  });

  it('asks nothing for no unit, no metric or an empty period', async () => {
    const request = { unitExternalIds: ['U1'], metrics: ['oee' as const], startMs: START, endMs: START + DAY, stepId: '1h' as const };

    await expect(service.exportAverages({ ...request, unitExternalIds: [] })).resolves.toEqual([]);
    await expect(service.exportAverages({ ...request, metrics: [] })).resolves.toEqual([]);
    await expect(service.exportAverages({ ...request, endMs: START })).resolves.toEqual([]);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('asks for the averages of every chosen time series at the chosen step', async () => {
    await service.exportAverages({
      unitExternalIds: ['U1', 'U2'],
      metrics: ['oee', 'off_spec'],
      startMs: START,
      endMs: START + DAY,
      stepId: '1h',
    });

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledWith({
      items: [
        { instanceId: { space: 'oee_ts_space', externalId: 'U1:oee' } },
        { instanceId: { space: 'oee_ts_space', externalId: 'U1:off_spec' } },
        { instanceId: { space: 'oee_ts_space', externalId: 'U2:oee' } },
        { instanceId: { space: 'oee_ts_space', externalId: 'U2:off_spec' } },
      ],
      start: START,
      end: START + DAY,
      aggregates: ['average'],
      granularity: '1h',
      limit: 24,
      ignoreUnknownIds: true,
    });
  });

  it('cuts a long period in windows of 10 000 averages', async () => {
    // 8 days at 1 minute: 11 520 averages for the time series.
    await service.exportAverages({
      unitExternalIds: ['U1'],
      metrics: ['oee'],
      startMs: START,
      endMs: START + 8 * DAY,
      stepId: '1m',
    });

    expect(retrieve.mock.calls.map(([query]) => ({ start: query.start, end: query.end, limit: query.limit }))).toEqual([
      { start: START, end: START + 10000 * MINUTE, limit: 10000 },
      { start: START + 10000 * MINUTE, end: START + 8 * DAY, limit: 10000 },
    ]);
  });

  it('returns the averages by unit and metric, without the empty time series, and reports its progress', async () => {
    retrieve.mockResolvedValue([
      makeAggregates('U1:oee', [{ average: 0.9 }, { average: 0.5 }]),
      makeAggregates('U1:quality', []),
    ]);
    const onProgress = vi.fn<(done: number, total: number) => void>();

    const series = await service.exportAverages(
      { unitExternalIds: ['U1'], metrics: ['oee', 'quality'], startMs: START, endMs: START + DAY, stepId: '1h' },
      onProgress
    );

    expect(series).toEqual([
      {
        unitExternalId: 'U1',
        metric: 'oee',
        points: [
          { timestamp: UPDATED_AT, value: 0.9 },
          { timestamp: UPDATED_AT - 3600000, value: 0.5 },
        ],
      },
    ]);
    expect(onProgress).toHaveBeenCalledWith(1, 1);
  });

  it('rejects when CDF fails', async () => {
    retrieve.mockRejectedValue(new Error('429'));

    await expect(
      service.exportAverages({ unitExternalIds: ['U1'], metrics: ['oee'], startMs: START, endMs: START + DAY, stepId: '1h' })
    ).rejects.toThrow('429');
  });
});

function makeAggregates(
  externalId: string,
  points: { average: number; count?: number }[]
): Extract<RetrieveResponse, { isStep: boolean }[]>[number] {
  return {
    id: 1,
    instanceId: { space: 'oee_ts_space', externalId },
    isString: false,
    isStep: false,
    datapoints: points.map((point, index) => ({ timestamp: new Date(UPDATED_AT - index * 3600000), ...point })),
  };
}

function makeAsset(externalId: string, name?: string, rootExternalId?: string): ListResponse['items'][number] {
  const asset: Record<string, string | { space: string; externalId: string }> = {};
  if (name !== undefined) asset.name = name;
  if (rootExternalId !== undefined) asset.root = { space: 'icapi_dm_space', externalId: rootExternalId };
  return {
    instanceType: 'node',
    version: 1,
    space: 'icapi_dm_space',
    externalId,
    createdTime: 0,
    lastUpdatedTime: 0,
    properties: { cdf_cdm: { 'CogniteAsset/v1': asset } },
  };
}

function makePage(items: ListResponse['items'], nextCursor?: string): ListResponse {
  return { items, nextCursor };
}

function makeLatest(externalId: string, value: number): LatestResponse[number] {
  return {
    id: 1,
    instanceId: { space: 'oee_ts_space', externalId },
    isString: false,
    datapoints: [{ timestamp: new Date(UPDATED_AT), value }],
  };
}
