import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { LOGO_HEIGHT, SHRINK_NOTE, shrinkLogo } from '../lib/shrink.mjs'

const png = (width, height) =>
  sharp({ create: { width, height, channels: 4, background: { r: 10, g: 80, b: 160, alpha: 1 } } }).png().toBuffer()

test('a wide PNG becomes a lossless WebP 128 px high, keeping the aspect ratio', async () => {
  const out = await shrinkLogo(await png(811, 331))
  const meta = await sharp(out).metadata()
  assert.equal(meta.format, 'webp')
  assert.equal(meta.height, LOGO_HEIGHT)
  assert.equal(meta.width, Math.round((811 * 128) / 331))
})

test('a logo already lower than 128 px is not enlarged', async () => {
  const meta = await sharp(await shrinkLogo(await png(200, 60))).metadata()
  assert.deepEqual([meta.width, meta.height, meta.format], [200, 60, 'webp'])
})

test('a JPEG served as .png is handled the same', async () => {
  const jpeg = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#fff' } }).jpeg().toBuffer()
  assert.equal((await sharp(await shrinkLogo(jpeg)).metadata()).height, 128)
})

test('the manifest note names the size, the format and the sharp version', () => {
  assert.match(SHRINK_NOTE, /128 px/)
  assert.match(SHRINK_NOTE, /WebP/)
  assert.match(SHRINK_NOTE, /sharp \d+\.\d+\.\d+/)
})
