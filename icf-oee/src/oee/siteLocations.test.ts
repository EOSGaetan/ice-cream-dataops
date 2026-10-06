import { describe, expect, it } from 'vitest';

import { getSiteCoordinates, MAP_VIEW, MAP_VIEW_BOX, toMapPosition } from './siteLocations';
import { MAP_HEIGHT, MAP_WIDTH } from './worldMap';

const SITE_IDS = [
  'chicago',
  'hannover',
  'houston',
  'kuala_lumpur',
  'london',
  'marseille',
  'nuremberg',
  'oslo',
  'rotterdam',
  'sao_paulo',
];

describe(getSiteCoordinates.name, () => {
  it('knows the ten sites of the Ice Cream Factory', () => {
    for (const siteId of SITE_IDS) {
      expect(getSiteCoordinates(siteId), siteId).not.toBeNull();
    }
  });

  it('returns null for an unknown site', () => {
    expect(getSiteCoordinates('atlantis')).toBeNull();
  });
});

describe(toMapPosition.name, () => {
  it('maps the corners of the shown map to 0% and 100%', () => {
    expect(toMapPosition({ latitude: MAP_VIEW.north, longitude: MAP_VIEW.west })).toEqual({ left: 0, top: 0 });
    expect(toMapPosition({ latitude: MAP_VIEW.south, longitude: MAP_VIEW.east })).toEqual({ left: 100, top: 100 });
  });

  it('places every site inside the shown map', () => {
    for (const siteId of SITE_IDS) {
      const coordinates = getSiteCoordinates(siteId);
      if (coordinates === null) throw new Error(`no coordinates for ${siteId}`);
      const { left, top } = toMapPosition(coordinates);
      expect(left, siteId).toBeGreaterThan(2);
      expect(left, siteId).toBeLessThan(98);
      expect(top, siteId).toBeGreaterThan(2);
      expect(top, siteId).toBeLessThan(98);
    }
  });

  it('places Oslo north-east of London', () => {
    const oslo = toMapPosition({ latitude: 59.91, longitude: 10.75 });
    const london = toMapPosition({ latitude: 51.51, longitude: -0.13 });

    expect(oslo.top).toBeLessThan(london.top);
    expect(oslo.left).toBeGreaterThan(london.left);
  });
});

describe('MAP_VIEW_BOX', () => {
  it('stays inside the world outline', () => {
    expect(MAP_VIEW_BOX.x).toBeGreaterThanOrEqual(0);
    expect(MAP_VIEW_BOX.y).toBeGreaterThanOrEqual(0);
    expect(MAP_VIEW_BOX.x + MAP_VIEW_BOX.width).toBeLessThanOrEqual(MAP_WIDTH);
    expect(MAP_VIEW_BOX.y + MAP_VIEW_BOX.height).toBeLessThanOrEqual(MAP_HEIGHT);
  });
});
