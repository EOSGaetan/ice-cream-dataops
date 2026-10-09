import { describe, expect, it } from 'vitest';

import { assetProperty, ASSET_VIEW_KEY, seriesExternalId } from '../config/model';

import { parseAsset } from './schema';

describe(parseAsset.name, () => {
  it('reads the name and the root of an asset instance', () => {
    const asset = parseAsset(
      makeInstance('U1', { name: 'Mixer', root: { space: 'icapi_dm_space', externalId: 'oslo' }, description: 'ignored' })
    );

    expect(asset).toEqual({ externalId: 'U1', name: 'Mixer', rootExternalId: 'oslo' });
  });

  it('falls back to the external id for an asset without name or with an empty name', () => {
    expect(parseAsset(makeInstance('U1', {})).name).toBe('U1');
    expect(parseAsset(makeInstance('U1', { name: '' })).name).toBe('U1');
  });

  it('has no root when the instance has none, or has no properties of the asset view', () => {
    expect(parseAsset(makeInstance('U1', { name: 'Mixer' })).rootExternalId).toBeNull();
    expect(parseAsset({ externalId: 'U1' })).toEqual({ externalId: 'U1', name: 'U1', rootExternalId: null });
    expect(parseAsset({ externalId: 'U1', properties: { other_space: {} } }).rootExternalId).toBeNull();
  });

  it('throws on a shape the app does not expect, instead of returning wrong data', () => {
    expect(() => parseAsset(makeInstance('U1', { name: 42 }))).toThrow();
    expect(() => parseAsset(makeInstance('U1', { root: 'oslo' }))).toThrow();
    expect(() => parseAsset({ properties: {} })).toThrow();
    expect(() => parseAsset(null)).toThrow();
  });
});

describe('data model configuration', () => {
  it('builds the key of the asset view, the reference of its properties and the id of a time series', () => {
    expect(ASSET_VIEW_KEY).toBe('CogniteAsset/v1');
    expect(assetProperty('root')).toEqual(['cdf_cdm', 'CogniteAsset/v1', 'root']);
    expect(seriesExternalId('U1', 'oee')).toBe('U1:oee');
  });
});

function makeInstance(externalId: string, properties: Record<string, unknown>): unknown {
  return {
    instanceType: 'node',
    space: 'icapi_dm_space',
    externalId,
    properties: { cdf_cdm: { 'CogniteAsset/v1': properties } },
  };
}
