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
  if (typeof scale !== 'number' || !Number.isInteger(scale) || scale < 1 || scale > 64) {
    throw invalid('Option scale must be an integer 1–64 (pixels per module).')
  }
  return scale
}

/**
 * Draw `text` as a QR code on `canvas`, resizing it to (modules + 2 × margin) × scale pixels. Same options, checks and
 * errors as toSvg; browser only (needs a canvas). Async because a logo has to load before anything is drawn.
 */
export async function drawQr(canvas: CanvasLike, text: string, options: CanvasOptions = {}): Promise<void> {
  const { scale: rawScale = 8, ...layoutOptions } = options
  const scale = checkScale(rawScale)
  const l = layout(text, layoutOptions)
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
  if (l.logo !== undefined && l.logo.background !== 'transparent') {
    const { box } = l.logo
    ctx.fillStyle = l.logo.background
    const c = (box.clearStart + l.margin) * scale
    ctx.fillRect(c, c, box.clearSide * scale, box.clearSide * scale)
  }
}
