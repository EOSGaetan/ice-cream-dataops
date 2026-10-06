import { describe, expect, it } from 'vitest';

import { DEFAULT_OEE_STATE, parseOeeState } from './oeeState';

describe(parseOeeState.name, () => {
  it('returns the default state when nothing was saved: the overview and the 1-week trend', () => {
    expect(parseOeeState(undefined)).toEqual(DEFAULT_OEE_STATE);
    expect(parseOeeState('')).toEqual(DEFAULT_OEE_STATE);
    expect(DEFAULT_OEE_STATE).toEqual({ view: 'overview', siteId: null, unitId: null, range: '1w' });
  });

  it('restores the view, the selected site and unit and the time frame', () => {
    const saved = { view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241', range: '1m' };

    expect(parseOeeState(JSON.stringify(saved))).toEqual(saved);
  });

  it('keeps the overview when it was saved with a selected site', () => {
    expect(parseOeeState(JSON.stringify({ view: 'overview', siteId: 'oslo' }))).toEqual({
      view: 'overview',
      siteId: 'oslo',
      unitId: null,
      range: '1w',
    });
  });

  it('opens the site tab for a link saved before the tabs existed', () => {
    expect(parseOeeState(JSON.stringify({ siteId: 'oslo', unitId: 'OSPRPATA241' }))).toEqual({
      view: 'site',
      siteId: 'oslo',
      unitId: 'OSPRPATA241',
      range: '1w',
    });
  });

  it('drops a unit that comes without a site', () => {
    expect(parseOeeState(JSON.stringify({ unitId: 'OSPRPATA241' }))).toEqual(DEFAULT_OEE_STATE);
  });

  it('ignores malformed or foreign state', () => {
    expect(parseOeeState('not json')).toEqual(DEFAULT_OEE_STATE);
    expect(parseOeeState('"text"')).toEqual(DEFAULT_OEE_STATE);
    expect(parseOeeState(JSON.stringify({ siteId: 42, unitId: [], view: 'map', range: '5y' }))).toEqual(
      DEFAULT_OEE_STATE
    );
  });
});
