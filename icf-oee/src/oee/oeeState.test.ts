import { describe, expect, it } from 'vitest';

import { DEFAULT_OEE_STATE, parseOeeState } from './oeeState';

describe(parseOeeState.name, () => {
  it('returns the default state when nothing was saved', () => {
    expect(parseOeeState(undefined)).toEqual(DEFAULT_OEE_STATE);
    expect(parseOeeState('')).toEqual(DEFAULT_OEE_STATE);
  });

  it('restores the selected site and unit', () => {
    expect(parseOeeState(JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }))).toEqual({
      siteId: 'oslo',
      unitId: 'OSPRPATA241',
    });
  });

  it('restores a site without a unit', () => {
    expect(parseOeeState(JSON.stringify({ siteId: 'oslo' }))).toEqual({ siteId: 'oslo', unitId: null });
  });

  it('drops a unit that comes without a site', () => {
    expect(parseOeeState(JSON.stringify({ unitId: 'OSPRPATA241' }))).toEqual(DEFAULT_OEE_STATE);
  });

  it('ignores malformed or foreign state', () => {
    expect(parseOeeState('not json')).toEqual(DEFAULT_OEE_STATE);
    expect(parseOeeState('"text"')).toEqual(DEFAULT_OEE_STATE);
    expect(parseOeeState(JSON.stringify({ siteId: 42, unitId: [] }))).toEqual(DEFAULT_OEE_STATE);
  });
});
