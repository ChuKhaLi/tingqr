import type { Canvas2DLike, CanvasLike } from '../src/canvas.js'

export type Call =
  | { op: 'fillRect' | 'clearRect'; x: number; y: number; w: number; h: number; fill: unknown }
  | { op: 'drawImage'; image: unknown; x: number; y: number; w: number; h: number }

/** A canvas that records every 2D call (with the fillStyle in force at the time) instead of drawing. */
export class FakeCanvas implements CanvasLike {
  width = 300
  height = 150
  calls: Call[] = []
  context: (Canvas2DLike & { fillStyle: unknown }) | null = {
    fillStyle: '#000000',
    fillRect: (x, y, w, h) => this.calls.push({ op: 'fillRect', x, y, w, h, fill: this.context?.fillStyle }),
    clearRect: (x, y, w, h) => this.calls.push({ op: 'clearRect', x, y, w, h, fill: undefined }),
    drawImage: (image, x, y, w, h) => this.calls.push({ op: 'drawImage', image, x, y, w, h }),
  }
  getContext(id: '2d'): Canvas2DLike | null {
    return id === '2d' ? this.context : null
  }
}

/** Dark cells ("x,y", module coordinates without the margin) painted with `colour` at `scale` px per module. */
export function paintedCells(calls: Call[], colour: string, scale: number, margin: number): Set<string> {
  const cells = new Set<string>()
  for (const c of calls) {
    if (c.op !== 'fillRect' || c.fill !== colour) continue
    expect(c.h).toBe(scale)
    expect(c.x % scale).toBe(0)
    expect(c.y % scale).toBe(0)
    expect(c.w % scale).toBe(0)
    for (let i = 0; i < c.w / scale; i++) cells.add(`${c.x / scale - margin + i},${c.y / scale - margin}`)
  }
  return cells
}

/** A fake canvas that can export: `toBlob`/`toDataURL` succeed, or throw `exportError` when set. */
export class ExportingCanvas extends FakeCanvas {
  exportError: unknown = undefined
  blobResult: 'blob' | 'null' = 'blob'
  toBlob(cb: (b: Blob | null) => void, type?: string): void {
    if (this.exportError !== undefined) throw this.exportError
    cb(this.blobResult === 'null' ? null : new Blob([`png ${this.width}`], { type: type ?? 'image/png' }))
  }
  toDataURL(type?: string): string {
    if (this.exportError !== undefined) throw this.exportError
    return `data:${type ?? 'image/png'};base64,${Buffer.from(`png ${this.width}`).toString('base64')}`
  }
}

export interface FakeImage {
  src: string
  crossOrigin: string | null
  naturalWidth: number
  naturalHeight: number
  decode(): Promise<void>
}

/** A fake Image class: decode() resolves with the given natural size, or rejects when `fail` is set. */
export function fakeImageClass(natural: { width: number; height: number }, fail = false) {
  const created: FakeImage[] = []
  class Img implements FakeImage {
    src = ''
    crossOrigin: string | null = null
    naturalWidth = natural.width
    naturalHeight = natural.height
    constructor() {
      created.push(this)
    }
    decode(): Promise<void> {
      return fail ? Promise.reject(new Error('EncodingError')) : Promise.resolve()
    }
  }
  return { FakeImage: Img, created }
}

export function darkCells(modules: boolean[][], skip: (x: number, y: number) => boolean = () => false): Set<string> {
  const cells = new Set<string>()
  modules.forEach((row, y) => row.forEach((dark, x) => dark && !skip(x, y) && cells.add(`${x},${y}`)))
  return cells
}
