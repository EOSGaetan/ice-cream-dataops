import { MAP_NORTH, MAP_SCALE } from './worldMap';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

/**
 * Where the sites are. The asset data of the project carries no coordinates, so the city of
 * each site is listed here, by site external id.
 */
const SITE_COORDINATES: Record<string, Coordinates> = {
  chicago: { latitude: 41.88, longitude: -87.63 },
  hannover: { latitude: 52.37, longitude: 9.73 },
  houston: { latitude: 29.76, longitude: -95.37 },
  kuala_lumpur: { latitude: 3.14, longitude: 101.69 },
  london: { latitude: 51.51, longitude: -0.13 },
  marseille: { latitude: 43.3, longitude: 5.37 },
  nuremberg: { latitude: 49.45, longitude: 11.08 },
  oslo: { latitude: 59.91, longitude: 10.75 },
  rotterdam: { latitude: 51.92, longitude: 4.48 },
  sao_paulo: { latitude: -23.55, longitude: -46.63 },
};

export function getSiteCoordinates(siteExternalId: string): Coordinates | null {
  return SITE_COORDINATES[siteExternalId] ?? null;
}

/** The part of the world map that is shown: it holds every site and leaves out empty ocean. */
export const MAP_VIEW = {
  west: -128,
  east: 128,
  north: 72,
  south: -44,
} as const;

/** The shown part of the map as an SVG viewBox, in the units of the world outline path. */
export const MAP_VIEW_BOX = {
  x: (MAP_VIEW.west + 180) * MAP_SCALE,
  y: (MAP_NORTH - MAP_VIEW.north) * MAP_SCALE,
  width: (MAP_VIEW.east - MAP_VIEW.west) * MAP_SCALE,
  height: (MAP_VIEW.north - MAP_VIEW.south) * MAP_SCALE,
} as const;

export type MapPosition = {
  /** Distance from the left edge of the shown map, in percent. */
  left: number;
  /** Distance from the top edge of the shown map, in percent. */
  top: number;
};

/** Places coordinates on the shown map (equirectangular projection). */
export function toMapPosition({ latitude, longitude }: Coordinates): MapPosition {
  return {
    left: ((longitude - MAP_VIEW.west) / (MAP_VIEW.east - MAP_VIEW.west)) * 100,
    top: ((MAP_VIEW.north - latitude) / (MAP_VIEW.north - MAP_VIEW.south)) * 100,
  };
}
