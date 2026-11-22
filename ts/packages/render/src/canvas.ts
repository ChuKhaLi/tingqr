/// <reference lib="dom" />
// Browser-only subpath (@tingqr/render/canvas): DOM types are referenced here and nowhere else in the package.
import { TingQrError } from '@tingqr/core'
import { invalid, layout, type LayoutOptions } from './layout.js'
import { forEachRun } from './svg.js'

/** The part of CanvasRenderingContext2D that tingqr uses. */
export interface Canvas2DLike {
  fillStyle: unknown
  fillRect(x: number, y: number, w: number, h: number): void
  clearRect(x: number, y: number, w: number, h: number): void
  drawImage(image: unknown, x: number, y: number, w: number, h: number): void
}

/** The part of HTMLCanvasElement / OffscreenCanvas that tingqr uses. */
export interface CanvasLike {
  width: number
  height: number
  getContext(id: '2d'): Canvas2DLike | null
}

export interface CanvasOptions extends LayoutOptions {
  /** Pixels per module, integer 1–64; default 8. Whole pixels keep the edges sharp. */
  scale?: number
}

function checkScale(scale: unknown): number {
  // Number.isInteger is false for every non-number, so no typeof check is needed.
  const n = scale as number
  if (!Number.isInteger(n) || n < 1 || n > 64) throw invalid('Option scale must be an integer 1–64 (pixels per module).')
  return n
}

interface LoadedImage {
  image: unknown
  width: number
  height: number
}

/** Load and decode the logo before anything is drawn: a code must never come out without the logo that was asked for. */
async function loadLogo(href: string): Promise<LoadedImage> {
  const ImageCtor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (ImageCtor === undefined) throw new TingQrError('NO_CANVAS', 'No Image constructor: drawing a logo needs a browser.')
  const img = new ImageCtor()
  // Ask for CORS so a cooperating server keeps the canvas exportable; data: and same-origin paths need nothing.
  if (/^https?:/.test(href)) img.crossOrigin = 'anonymous' // checkLogoHref accepts lowercase schemes only
  img.src = href
  try {
    await img.decode()
  } catch {
    throw new TingQrError('LOGO_LOAD_FAILED', `The logo ${JSON.stringify(href.slice(0, 80))} could not be loaded or decoded` +
        (/^https?:/.test(href) ? ' (a logo on another origin needs CORS headers; or use a data URI, e.g. from @tingqr/bank-logos).' : '.'))
  }
  if (img.naturalWidth > 0 && img.naturalHeight > 0) return { image: img, width: img.naturalWidth, height: img.naturalHeight }
  // An SVG without width/height has no natural size (0×0 in browsers) but draws fine at any size: fill the logo square.
  if (href.startsWith('data:image/svg+xml')) return { image: img, width: 1, height: 1 }
  throw new TingQrError('LOGO_LOAD_FAILED', 'The logo decoded to an empty image.')
}

/**
 * Draw `text` as a QR code on `canvas`, resizing it to (modules + 2 × margin) × scale pixels. Same options, checks and
 * errors as toSvg; browser only (needs a canvas). Async because a logo has to load before anything is drawn.
 */
export async function drawQr(canvas: CanvasLike, text: string, options: CanvasOptions = {}): Promise<void> {
  const { scale: rawScale = 8, ...layoutOptions } = options
  const scale = checkScale(rawScale)
  const l = layout(text, layoutOptions)
  const logo = l.logo === undefined ? undefined : { ...l.logo, image: await loadLogo(l.logo.href) }
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new TingQrError('NO_CANVAS', 'The canvas has no 2D context.')

  const side = (l.size + 2 * l.margin) * scale
  canvas.width = side
  canvas.height = side
  if (l.background === 'transparent') {
    ctx.clearRect(0, 0, side, side)
  } else {
    ctx.fillStyle = l.background
    ctx.fillRect(0, 0, side, side)
  }
  ctx.fillStyle = l.foreground
  forEachRun(l.modules, l.cleared, (x, y, length) => {
    ctx.fillRect((x + l.margin) * scale, (y + l.margin) * scale, length * scale, scale)
  })
  if (logo === undefined) return

  const { box, image: loaded } = logo
  if (logo.background !== 'transparent') {
    ctx.fillStyle = logo.background
    const c = (box.clearStart + l.margin) * scale
    ctx.fillRect(c, c, box.clearSide * scale, box.clearSide * scale)
  }
  // Fit inside the logo square keeping the aspect ratio, centred: SVG's preserveAspectRatio="xMidYMid meet".
  const logoSide = box.logoSide * scale
  const k = Math.min(logoSide / loaded.width, logoSide / loaded.height)
  const w = loaded.width * k
  const h = loaded.height * k
  const p = (box.logoStart + l.margin) * scale
  ctx.drawImage(loaded.image, p + (logoSide - w) / 2, p + (logoSide - h) / 2, w, h)
}

function newCanvas(): HTMLCanvasElement {
  const doc = (globalThis as { document?: Document }).document
  if (doc === undefined) throw new TingQrError('NO_CANVAS', 'No document: PNG export needs a browser (use toSvg on a server).')
  return doc.createElement('canvas')
}

/** Run a canvas export, turning the browser's SecurityError for a tainted canvas into CANVAS_TAINTED. */
function exporting<T>(run: () => T): T {
  try {
    return run()
  } catch (e) {
    if ((e as { name?: unknown } | null)?.name === 'SecurityError') {
      throw new TingQrError(
        'CANVAS_TAINTED',
        'The canvas cannot be exported: a cross-origin image tainted it (e.g. a logo redirected to another origin). Use a data URI (e.g. from ' +
          '@tingqr/bank-logos) or a same-origin image.',
      )
    }
    throw e
  }
}

function blobOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      exporting(() =>
        canvas.toBlob((blob) => {
          if (blob === null) reject(new TingQrError('NO_CANVAS', 'The browser could not encode the canvas as PNG.'))
          else resolve(blob)
        }, 'image/png'),
      )
    } catch (e) {
      reject(e)
    }
  })
}

/** PNG data URL of the canvas. Browsers return "data:," (no throw) for a canvas over their size limit. */
function dataUrlOf(canvas: HTMLCanvasElement): string {
  const url = exporting(() => canvas.toDataURL('image/png'))
  if (!url.startsWith('data:image/png')) {
    throw new TingQrError('NO_CANVAS', 'The browser could not encode the canvas as PNG (too large? use a smaller scale).')
  }
  return url
}

async function drawn(text: string, options: CanvasOptions): Promise<HTMLCanvasElement> {
  const canvas = newCanvasChecked(text, options)
  await drawQr(canvas, text, options)
  return canvas
}

/** Draw `text` on a new canvas and export it as a PNG Blob. Browser only. */
export async function toPngBlob(text: string, options: CanvasOptions = {}): Promise<Blob> {
  return blobOf(await drawn(text, options))
}

/** Draw `text` on a new canvas and export it as a PNG data URL (meant to be long-press savable in in-app browsers; not yet tested in Zalo/Messenger). Browser only. */
export async function toPngDataUrl(text: string, options: CanvasOptions = {}): Promise<string> {
  const canvas = await drawn(text, options)
  return dataUrlOf(canvas)
}

/** Draw once and export both: a data URL to show in an `<img>` and a Blob to share or download. Browser only. */
export async function toPng(text: string, options: CanvasOptions = {}): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = await drawn(text, options)
  const dataUrl = dataUrlOf(canvas)
  return { blob: await blobOf(canvas), dataUrl }
}

/** Report bad options as INVALID_VALUE even where there is no canvas. */
function newCanvasChecked(text: string, options: CanvasOptions): HTMLCanvasElement {
  const { scale = 8, ...layoutOptions } = options
  checkScale(scale)
  layout(text, layoutOptions)
  return newCanvas()
}
