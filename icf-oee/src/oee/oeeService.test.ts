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
