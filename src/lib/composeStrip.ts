import { FILTER_CSS, LAYOUT_DIMENSIONS, LAYOUT_FRAME_COUNT } from '../types'
import type { Layout, FilterName } from '../types'

// Detect ctx.filter support once at module load
const supportsCtxFilter = (() => {
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    return typeof ctx?.filter === 'string'
  } catch {
    return false
  }
})()

/**
 * Compose captured frames into a single strip canvas and return as a PNG Blob.
 * Pure function — no side effects, no global state.
 */
export async function composeStrip(
  frames: ImageBitmap[],
  layout: Layout,
  filter: FilterName,
  overlay: File | null,
): Promise<Blob> {
  const { w, h } = LAYOUT_DIMENSIONS[layout]
  const frameCount = LAYOUT_FRAME_COUNT[layout]
  const frameH = h / frameCount

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  if (supportsCtxFilter) {
    await drawWithCtxFilter(ctx, frames, layout, filter, frameH, w, frameCount)
  } else {
    await drawWithHtml2canvasFallback(ctx, frames, layout, filter, frameH, w, frameCount)
  }

  // Draw overlay on top
  if (overlay) {
    await drawOverlay(ctx, overlay, w, h)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob returned null'))
    }, 'image/png')
  })
}

async function drawWithCtxFilter(
  ctx: CanvasRenderingContext2D,
  frames: ImageBitmap[],
  layout: Layout,
  filter: FilterName,
  frameH: number,
  w: number,
  frameCount: number,
): Promise<void> {
  const filterStr = FILTER_CSS[filter]

  if (layout === '2x2') {
    // 2×2 grid: 2 columns, 2 rows
    const cellH = ctx.canvas.height / 2
    const cellW = w / 2
    for (let i = 0; i < Math.min(frames.length, frameCount); i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      ctx.filter = filterStr
      ctx.drawImage(frames[i], col * cellW, row * cellH, cellW, cellH)
      ctx.filter = 'none'
    }
  } else {
    // Strip layouts: vertical stack
    for (let i = 0; i < Math.min(frames.length, frameCount); i++) {
      ctx.filter = filterStr
      ctx.drawImage(frames[i], 0, i * frameH, w, frameH)
      ctx.filter = 'none'
    }
  }
}

async function drawWithHtml2canvasFallback(
  ctx: CanvasRenderingContext2D,
  frames: ImageBitmap[],
  layout: Layout,
  filter: FilterName,
  frameH: number,
  w: number,
  frameCount: number,
): Promise<void> {
  // First draw frames without filter
  for (let i = 0; i < Math.min(frames.length, frameCount); i++) {
    if (layout === '2x2') {
      const cellH = ctx.canvas.height / 2
      const cellW = w / 2
      const col = i % 2
      const row = Math.floor(i / 2)
      ctx.drawImage(frames[i], col * cellW, row * cellH, cellW, cellH)
    } else {
      ctx.drawImage(frames[i], 0, i * frameH, w, frameH)
    }
  }

  // Apply filter via html2canvas if filter is not 'none'
  if (filter === 'none') return

  try {
    const html2canvas = (await import('html2canvas')).default

    // Create an off-screen div with the filter applied to a temp canvas
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = ctx.canvas.width
    tempCanvas.height = ctx.canvas.height
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.drawImage(ctx.canvas, 0, 0)

    const container = document.createElement('div')
    container.style.cssText = `
      position: fixed; top: -9999px; left: -9999px;
      width: ${ctx.canvas.width}px; height: ${ctx.canvas.height}px;
      filter: ${FILTER_CSS[filter]};
    `
    container.appendChild(tempCanvas)
    document.body.appendChild(container)

    try {
      const filteredCanvas = await html2canvas(container, {
        canvas: ctx.canvas,
        useCORS: true,
        allowTaint: false,
      })
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.drawImage(filteredCanvas, 0, 0)
    } finally {
      document.body.removeChild(container)
    }
  } catch {
    // html2canvas failed — strip saves without filter bake-in
    // The visual result is already drawn (unfiltered), so this is recoverable
    console.warn('[composeStrip] html2canvas fallback failed — strip saved without filter')
  }
}

async function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: File,
  w: number,
  h: number,
): Promise<void> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(overlay)
    const img = new Image()
    img.onload = () => {
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(img, 0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve() // Non-fatal — skip overlay on error
    }
    img.src = url
  })
}
