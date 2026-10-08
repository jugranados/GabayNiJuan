/**
 * Photo assets are stored by id. Resolving an id to a URL needs the Storage
 * bucket, which is not set up yet, so only ids that already are web links
 * resolve. Everything else shows the placeholder.
 */
export function photoUrlFor(photoAssetId: string | undefined): string | undefined {
  return photoAssetId && /^https:\/\//i.test(photoAssetId) ? photoAssetId : undefined;
}
