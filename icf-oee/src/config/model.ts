/**
 * Every identifier of the CDF data model the app reads, in one place: porting the app to another
 * project, or following a renamed space or a new view version, means editing this file only.
 */
export const MODEL = {
  /** The space of the asset instances (sites, lines, units). */
  assetSpace: 'icapi_dm_space',
  /** The space of the computed OEE time series. */
  oeeSpace: 'oee_ts_space',
  /** The view the assets are read through. */
  assetView: { type: 'view', space: 'cdf_cdm', externalId: 'CogniteAsset', version: 'v1' },
  /** The properties of the asset view the app reads. */
  assetProperties: { name: 'name', parent: 'parent', root: 'root' },
} as const;

/** The key of the asset view inside the `properties` of an instance: "CogniteAsset/v1". */
export const ASSET_VIEW_KEY = `${MODEL.assetView.externalId}/${MODEL.assetView.version}`;

/** The reference of a property of the asset view, as filters expect it. */
export function assetProperty(name: keyof typeof MODEL.assetProperties): string[] {
  return [MODEL.assetView.space, ASSET_VIEW_KEY, MODEL.assetProperties[name]];
}

/** The external id of a computed time series of an asset: "<asset>:oee", "<asset>:quality"… */
export function seriesExternalId(assetExternalId: string, metric: string): string {
  return `${assetExternalId}:${metric}`;
}
