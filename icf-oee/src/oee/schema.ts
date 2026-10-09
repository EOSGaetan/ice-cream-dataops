// The "mini" build of Zod: same validation, without the 100 kB of the full build in the bundle.
import * as z from 'zod/mini';

import { ASSET_VIEW_KEY, MODEL } from '../config/model';

/**
 * What the app reads from an asset instance. Instance properties are loosely typed in the SDK:
 * they are parsed here, once, where they enter the app. A wrong shape throws and shows as a read
 * error instead of silently wrong data.
 */
const AssetPropertiesSchema = z.object({
  [MODEL.assetProperties.name]: z.optional(z.string()),
  /** The direct relation to the root asset: the site. */
  [MODEL.assetProperties.root]: z.optional(z.object({ space: z.string(), externalId: z.string() })),
});

const AssetInstanceSchema = z.object({
  externalId: z.string(),
  properties: z.optional(
    z.object({
      [MODEL.assetView.space]: z.optional(z.object({ [ASSET_VIEW_KEY]: z.optional(AssetPropertiesSchema) })),
    })
  ),
});

/** An asset as the app uses it. */
export type Asset = {
  externalId: string;
  /** The name of the asset, or its external id when it has no name. */
  name: string;
  /** The external id of the root asset (the site); a site is its own root. Null when unknown. */
  rootExternalId: string | null;
};

/** Parses one instance returned by `instances.list` into an asset. Throws on an unexpected shape. */
export function parseAsset(instance: unknown): Asset {
  const parsed = AssetInstanceSchema.parse(instance);
  const properties = parsed.properties?.[MODEL.assetView.space]?.[ASSET_VIEW_KEY];
  const name = properties?.[MODEL.assetProperties.name];
  return {
    externalId: parsed.externalId,
    name: name === undefined || name === '' ? parsed.externalId : name,
    rootExternalId: properties?.[MODEL.assetProperties.root]?.externalId ?? null,
  };
}
