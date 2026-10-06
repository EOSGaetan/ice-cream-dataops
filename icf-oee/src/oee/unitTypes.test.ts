import { describe, expect, it } from 'vitest';

import type { Site, UnitPeriodStats } from './types';
import { belowAlertShare, groupUnitTypes } from './unitTypes';
import type { UnitTypeMember } from './unitTypes';

const OSLO: Site = { externalId: 'oslo', name: 'Oslo' };
const HOUSTON: Site = { externalId: 'houston', name: 'Houston' };

describe(belowAlertShare.name, () => {
  it('is the share of the periods below the alert threshold', () => {
    expect(belowAlertShare(makeStats('U1', { periods: 10, periodsBelowAlert: 4 }))).toBe(0.4);
  });

  it('is unknown without statistics or without periods', () => {
    expect(belowAlertShare(null)).toBeNull();
    expect(belowAlertShare(makeStats('U1', { periods: 0, periodsBelowAlert: 0 }))).toBeNull();
  });
});

describe(groupUnitTypes.name, () => {
  it('returns nothing for no unit', () => {
    expect(groupUnitTypes([])).toEqual([]);
  });

  it('groups the units of every site by name', () => {
    const types = groupUnitTypes([
      makeMember(OSLO, 'O1', 'Mixer'),
      makeMember(OSLO, 'O2', 'Mixer'),
      makeMember(HOUSTON, 'H1', 'Mixer'),
      makeMember(HOUSTON, 'H2', 'Tank'),
    ]);

    const mixer = types.find((type) => type.name === 'Mixer');
    expect(mixer?.unitCount).toBe(3);
    expect(mixer?.siteCount).toBe(2);
    expect(types.find((type) => type.name === 'Tank')?.unitCount).toBe(1);
  });

  it('pools the periods of the units: mean OEE and share of the time below the threshold', () => {
    const [type] = groupUnitTypes([
      makeMember(OSLO, 'O1', 'Mixer', { meanOee: 0.9, periods: 100, periodsBelowAlert: 10 }),
      makeMember(HOUSTON, 'H1', 'Mixer', { meanOee: 0.5, periods: 300, periodsBelowAlert: 150 }),
    ]);

    expect(type.meanOee).toBeCloseTo(0.6);
    expect(type.belowAlertShare).toBeCloseTo(0.4);
  });

  it('averages quality, performance and availability over the units that have them', () => {
    const [type] = groupUnitTypes([
      makeMember(OSLO, 'O1', 'Mixer', { quality: 0.8, performance: 1, availability: 0.5 }),
      makeMember(OSLO, 'O2', 'Mixer', { quality: 0.6, performance: null, availability: 0.7 }),
    ]);

    expect(type.quality).toBeCloseTo(0.7);
    expect(type.performance).toBe(1);
    expect(type.availability).toBeCloseTo(0.6);
  });

  it('names the site where the type has the lowest mean OEE', () => {
    const [type] = groupUnitTypes([
      makeMember(OSLO, 'O1', 'Mixer', { meanOee: 0.9, periods: 10 }),
      makeMember(HOUSTON, 'H1', 'Mixer', { meanOee: 0.8, periods: 10 }),
      makeMember(HOUSTON, 'H2', 'Mixer', { meanOee: 0.4, periods: 10 }),
    ]);

    expect(type.lowestSite?.site).toEqual(HOUSTON);
    expect(type.lowestSite?.meanOee).toBeCloseTo(0.6);
  });

  it('lists the units of a type with the lowest mean OEE first', () => {
    const [type] = groupUnitTypes([
      makeMember(OSLO, 'O1', 'Mixer', { meanOee: 0.9 }),
      makeMember(HOUSTON, 'H1', 'Mixer', { meanOee: 0.2 }),
      makeMember(HOUSTON, 'H2', 'Mixer', null),
    ]);

    expect(type.members.map((member) => member.unit.externalId)).toEqual(['H1', 'O1', 'H2']);
  });

  it('ranks the types: most time below the threshold first, then lowest mean OEE', () => {
    const types = groupUnitTypes([
      makeMember(OSLO, 'A', 'Good', { meanOee: 0.95, periods: 100, periodsBelowAlert: 0 }),
      makeMember(OSLO, 'B', 'Worst', { meanOee: 0.6, periods: 100, periodsBelowAlert: 50 }),
      makeMember(OSLO, 'C', 'Low mean', { meanOee: 0.8, periods: 100, periodsBelowAlert: 0 }),
      makeMember(OSLO, 'D', 'No data', null),
    ]);

    expect(types.map((type) => type.name)).toEqual(['Worst', 'Low mean', 'Good', 'No data']);
  });

  it('has no figures for a type whose units have no statistics', () => {
    const [type] = groupUnitTypes([makeMember(OSLO, 'A', 'Silent', null)]);

    expect(type).toMatchObject({
      meanOee: null,
      belowAlertShare: null,
      quality: null,
      performance: null,
      availability: null,
      lowestSite: null,
    });
  });
});

function makeStats(externalId: string, overrides: Partial<UnitPeriodStats> = {}): UnitPeriodStats {
  return {
    externalId,
    meanOee: 0.9,
    periods: 100,
    periodsBelowAlert: 0,
    quality: 0.95,
    performance: 0.95,
    availability: 1,
    ...overrides,
  };
}

function makeMember(
  site: Site,
  externalId: string,
  name: string,
  stats: Partial<UnitPeriodStats> | null = {}
): UnitTypeMember {
  return {
    site,
    unit: { externalId, name, oee: 0.9, quality: 0.95, performance: 0.95, availability: 1, updatedAt: 0 },
    stats: stats === null ? null : makeStats(externalId, stats),
  };
}
