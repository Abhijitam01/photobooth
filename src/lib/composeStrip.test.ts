import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LAYOUT_DIMENSIONS } from '../types'

// Mock html2canvas before importing composeStrip
vi.mock('html2canvas', () => ({
  default: vi.fn(async () => {
    const c = document.createElement('canvas')
    c.width = 600
    c.height = 2400
    return c
  }),
}))

// We need to control supportsCtxFilter. It's evaluated at module load time via an IIFE.
// We mock the canvas getContext to control whether ctx.filter is a string.
function makeCtxMock(supportsFilter = true) {
  return {
    filter: supportsFilter ? 'none' : undefined,
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    canvas: { width: 600, height: 2400 },
    globalCompositeOperation: 'source-over',
  }
}

function makeFakeFrame(): ImageBitmap {
  return { width: 600, height: 600, close: vi.fn() } as unknown as ImageBitmap
}

describe('composeStrip', () => {
  let mockCtx: ReturnType<typeof makeCtxMock>

  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx = makeCtxMock(true)
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockCtx),
          toBlob: vi.fn((cb: (b: Blob | null) => void) => {
            cb(new Blob(['png-data'], { type: 'image/png' }))
          }),
          appendChild: vi.fn(),
        }
        return canvas as unknown as HTMLElement
      }
      if (tag === 'div') {
        return {
          style: { cssText: '' },
          appendChild: vi.fn(),
        } as unknown as HTMLElement
      }
      return origCreateElement(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body)
  })

  it('returns a Blob for 4-strip layout with 4 frames', async () => {
    const { composeStrip } = await import('./composeStrip')
    const frames = [makeFakeFrame(), makeFakeFrame(), makeFakeFrame(), makeFakeFrame()]
    const result = await composeStrip(frames, '4-strip', 'none', null)
    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('image/png')
  })

  it('sets canvas dimensions from LAYOUT_DIMENSIONS for each layout', async () => {
    const { composeStrip } = await import('./composeStrip')
    const frames = [makeFakeFrame(), makeFakeFrame()]

    const canvasElements: Array<{ width: number; height: number }> = []
    const origCreateElement2 = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({ ...mockCtx, canvas: canvas })),
          toBlob: vi.fn((cb: (b: Blob | null) => void) => {
            cb(new Blob(['png'], { type: 'image/png' }))
          }),
          appendChild: vi.fn(),
        }
        canvasElements.push(canvas)
        return canvas as unknown as HTMLElement
      }
      return origCreateElement2(tag) as unknown as HTMLElement
    })

    await composeStrip(frames, '2x2', 'none', null)
    const { w, h } = LAYOUT_DIMENSIONS['2x2']
    // The first canvas created should have 2x2 dimensions
    expect(canvasElements[0].width).toBe(w)
    expect(canvasElements[0].height).toBe(h)
  })

  it('calls drawImage for each frame in strip layout', async () => {
    const { composeStrip } = await import('./composeStrip')
    const frames = [makeFakeFrame(), makeFakeFrame(), makeFakeFrame()]
    await composeStrip(frames, '3-strip', 'none', null)
    // drawImage called once per frame
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(3)
  })

  it('applies ctx.filter before each drawImage when filter is bw', async () => {
    const { composeStrip } = await import('./composeStrip')
    const filterValues: string[] = []
    const trackingCtx = {
      ...mockCtx,
      set filter(v: string) { filterValues.push(v) },
      get filter() { return filterValues[filterValues.length - 1] ?? 'none' },
    }
    const origCreateElement3 = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const canvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => trackingCtx),
          toBlob: vi.fn((cb: (b: Blob | null) => void) => {
            cb(new Blob(['png'], { type: 'image/png' }))
          }),
        }
        return canvas as unknown as HTMLElement
      }
      return origCreateElement3(tag) as unknown as HTMLElement
    })

    const frames = [makeFakeFrame(), makeFakeFrame()]
    await composeStrip(frames, '4-strip', 'bw', null)

    // bw filter should have been set
    expect(filterValues).toContain('grayscale(100%)')
  })

  it('returns a Blob even when html2canvas fallback throws', async () => {
    const html2canvasMod = await import('html2canvas')
    vi.mocked(html2canvasMod.default).mockRejectedValueOnce(new Error('html2canvas failed'))

    const { composeStrip } = await import('./composeStrip')
    const frames = [makeFakeFrame()]
    const result = await composeStrip(frames, 'single', 'bw', null)
    // Should still return a Blob (unfiltered) — failure is non-fatal
    expect(result).toBeInstanceOf(Blob)
  })

  it('draws overlay with source-over composite operation', async () => {
    const { composeStrip } = await import('./composeStrip')
    const frames = [makeFakeFrame()]

    // Stub Image to fire onload immediately
    const originalImage = global.Image
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      private _src = ''
      set src(v: string) {
        this._src = v
        setTimeout(() => this.onload?.(), 0)
      }
      get src() { return this._src }
    }
    global.Image = FakeImage as unknown as typeof Image

    const compositeOps: string[] = []
    const overlayCtx = {
      ...mockCtx,
      set globalCompositeOperation(v: string) { compositeOps.push(v) },
      get globalCompositeOperation() { return 'source-over' },
    }
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => overlayCtx),
          toBlob: vi.fn((cb: (b: Blob | null) => void) => {
            cb(new Blob(['png'], { type: 'image/png' }))
          }),
        } as unknown as HTMLElement
      }
      return { style: { cssText: '' }, appendChild: vi.fn() } as unknown as HTMLElement
    })

    const overlayFile = new File(['overlay-png'], 'overlay.png', { type: 'image/png' })
    await composeStrip(frames, 'single', 'none', overlayFile)

    global.Image = originalImage

    // source-over should have been set for overlay compositing
    expect(compositeOps).toContain('source-over')
  })
})
