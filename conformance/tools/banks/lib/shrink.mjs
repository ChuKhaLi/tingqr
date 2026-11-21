// Shrink a raster bank logo for @tingqr/bank-logos (owner's choice 2026-11-21: 128 px high, lossless WebP).
// sharp is a devDependency of this tool only; no published package depends on it.
import { createRequire } from 'node:module'
import sharp from 'sharp'

export const LOGO_HEIGHT = 128
const SHARP_VERSION = createRequire(import.meta.url)('sharp/package.json').version
export const SHRINK_NOTE = `resized to ${LOGO_HEIGHT} px high (never enlarged), lossless WebP, sharp ${SHARP_VERSION}`

/** PNG or JPEG bytes → lossless WebP at most LOGO_HEIGHT px high, aspect ratio kept. */
export async function shrinkLogo(bytes) {
  return sharp(bytes).resize({ height: LOGO_HEIGHT, withoutEnlargement: true }).webp({ lossless: true }).toBuffer()
}
