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

describe('CdfOeeService.getUnitPeriodStats', () => {
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

  it('asks nothing for no unit', async () => {
    await expect(service.getUnitPeriodStats([], UPDATED_AT, '1w')).resolves.toEqual([]);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('asks for the OEE at the granularity of the time frame, over whole days', async () => {
    await service.getUnitPeriodStats(['U1', 'U2'], UPDATED_AT, '1w');

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

  it('asks for the mean quality, performance and availability with a few large periods', async () => {
    await service.getUnitPeriodStats(['U1'], UPDATED_AT, '1w');

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
    { range: '1m', days: 30, granularity: '4h', coarse: '1d' },
    { range: '1y', days: 365, granularity: '1d', coarse: '30d' },
  ] as const)('uses $granularity and $coarse averages for the $range time frame', async ({ range, days, granularity, coarse }) => {
    await service.getUnitPeriodStats(['U1'], UPDATED_AT, range);

    const start = Date.UTC(2026, 9, 4) - days * 24 * 60 * 60 * 1000;
    expect(retrieve).toHaveBeenCalledWith(expect.objectContaining({ start, granularity, aggregates: ['average'] }));
    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ start, granularity: coarse, aggregates: ['average', 'count'] })
    );
  });

  it('stays under 100 time series and 10 000 aggregates per request', async () => {
    const units = Array.from({ length: 120 }, (_, index) => `U${index}`);

    await service.getUnitPeriodStats(units, UPDATED_AT, '1w');

    const calls = retrieve.mock.calls.map(([query]) => ({
      items: query.items.length,
      aggregates: query.items.length * (query.limit ?? 0),
      granularity: query.granularity,
    }));
    // OEE: 182 hourly averages per unit, so 54 units per request. Components: 360 series, 100 per request.
    expect(calls.filter((call) => call.granularity === '1h').map((call) => call.items)).toEqual([54, 54, 12]);
    expect(calls.filter((call) => call.granularity === '1d').map((call) => call.items)).toEqual([100, 100, 100, 60]);
    expect(calls.every((call) => call.items <= 100 && call.aggregates <= 10000)).toBe(true);
  });

  it('computes the mean OEE, the periods below the alert threshold and the weighted component means', async () => {
    retrieve.mockImplementation((query) =>
      Promise.resolve(
        query.granularity === '1h'
          ? [makeAggregates('U1:oee', [{ average: 0.9 }, { average: 0.5 }, { average: 0.4 }])]
          : [
              makeAggregates('U1:quality', [
                { average: 1, count: 300 },
                { average: 0.6, count: 100 },
              ]),
              makeAggregates('U1:performance', [{ average: 0.8, count: 10 }]),
            ]
      )
    );

    const [stats] = await service.getUnitPeriodStats(['U1'], UPDATED_AT, '1w');

    expect(stats.externalId).toBe('U1');
    expect(stats.meanOee).toBeCloseTo(0.6);
    expect(stats.periods).toBe(3);
    expect(stats.periodsBelowAlert).toBe(2);
    expect(stats.quality).toBeCloseTo(0.9);
    expect(stats.performance).toBeCloseTo(0.8);
    expect(stats.availability).toBeNull();
  });

  it('returns empty statistics for a unit without datapoints, in the order of the request', async () => {
    retrieve.mockImplementation((query) =>
      Promise.resolve(query.granularity === '1h' ? [makeAggregates('U2:oee', [{ average: 0.8 }])] : [])
    );

    const stats = await service.getUnitPeriodStats(['U1', 'U2'], UPDATED_AT, '1w');

    expect(stats).toEqual([
      { externalId: 'U1', meanOee: null, periods: 0, periodsBelowAlert: 0, quality: null, performance: null, availability: null },
      { externalId: 'U2', meanOee: 0.8, periods: 1, periodsBelowAlert: 0, quality: null, performance: null, availability: null },
    ]);
  });

  it('rejects when CDF fails', async () => {
    retrieve.mockRejectedValue(new Error('429'));

    await expect(service.getUnitPeriodStats(['U1'], UPDATED_AT, '1w')).rejects.toThrow('429');
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

function makeAsset(externalId: string, name?: string): ListResponse['items'][number] {
  return {
    instanceType: 'node',
    version: 1,
    space: 'icapi_dm_space',
    externalId,
    createdTime: 0,
    lastUpdatedTime: 0,
    properties: { cdf_cdm: { 'CogniteAsset/v1': name === undefined ? {} : { name } } },
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
