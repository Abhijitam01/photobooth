const GIF_TIMEOUT_MS = 15_000
const GIF_FRAME_DELAY = 500 // ms between frames

/**
 * Returns true if GIF encoding is available in this browser.
 * Call once at app init to decide whether to show the Export GIF button.
 */
export function isGifAvailable(): boolean {
  return typeof Worker !== 'undefined'
}

/**
 * Encode an array of JPEG data URLs into a GIF Blob.
 *
 * Accepts JPEG data URLs (not ImageBitmaps) to avoid Worker transfer issues
 * and abort race conditions.
 *
 * @param jpegDataUrls  Array of JPEG data URL strings (one per frame)
 * @param onProgress    Called with 0-100 as encoding progresses
 * @param signal        AbortSignal — if aborted, encoding stops and null is returned
 * @returns             GIF Blob, or null on timeout/abort/failure
 */
export async function encodeGif(
  jpegDataUrls: string[],
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<Blob | null> {
  if (!isGifAvailable()) return null
  if (jpegDataUrls.length === 0) return null

  return new Promise<Blob | null>(resolve => {
    if (signal.aborted) { resolve(null); return }
    let settled = false
    let encoder: { abort: () => void } | null = null

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true
        encoder?.abort()
        resolve(null)
      }
    }, GIF_TIMEOUT_MS)

    signal.addEventListener('abort', () => {
      if (!settled) {
        settled = true
        clearTimeout(timeoutId)
        encoder?.abort()
        resolve(null)
      }
    })

    // Dynamic import so the heavy gif-encoder-2 bundle only loads when needed
    import('gif-encoder-2').then(({ default: GifEncoder }) => {
      if (settled) return

      try {
        // Determine dimensions from first frame
        const tempImg = new Image()
        tempImg.onload = () => {
          if (settled) return

          const width = tempImg.naturalWidth
          const height = tempImg.naturalHeight

          let enc: InstanceType<typeof GifEncoder>
          try {
            const workerCount = typeof SharedArrayBuffer !== 'undefined' ? 2 : 1
            enc = new GifEncoder(width, height, 'neuquant', true, jpegDataUrls.length)
            enc.setDelay(GIF_FRAME_DELAY)
            enc.setRepeat(0) // Loop forever
            enc.setQuality(10)
            encoder = { abort: () => enc.emit('abort') }
          } catch {
            settled = true
            clearTimeout(timeoutId)
            resolve(null)
            return
          }

          const chunks: Uint8Array[] = []
          let framesProcessed = 0

          enc.on('data', (chunk: Uint8Array) => {
            chunks.push(chunk)
          })

          enc.on('progress', (p: number) => {
            if (!settled) onProgress(Math.round(p))
          })

          enc.on('finished', (blob: Blob) => {
            if (!settled) {
              settled = true
              clearTimeout(timeoutId)
              resolve(blob)
            }
          })

          enc.on('error', () => {
            if (!settled) {
              settled = true
              clearTimeout(timeoutId)
              resolve(null)
            }
          })

          // Start encoding
          enc.start()

          // Add each frame by drawing JPEG data URLs onto a canvas
          const addFrames = async () => {
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')!

            for (const dataUrl of jpegDataUrls) {
              if (settled) break
              await new Promise<void>(res => {
                const img = new Image()
                img.onload = () => {
                  ctx.clearRect(0, 0, width, height)
                  ctx.drawImage(img, 0, 0, width, height)
                  enc.addFrame(ctx)
                  framesProcessed++
                  res()
                }
                img.onerror = () => res()
                img.src = dataUrl
              })
            }

            if (!settled) {
              enc.finish()
            }
          }

          addFrames().catch(() => {
            if (!settled) {
              settled = true
              clearTimeout(timeoutId)
              resolve(null)
            }
          })
        }

        tempImg.onerror = () => {
          if (!settled) {
            settled = true
            clearTimeout(timeoutId)
            resolve(null)
          }
        }

        tempImg.src = jpegDataUrls[0]
      } catch {
        if (!settled) {
          settled = true
          clearTimeout(timeoutId)
          resolve(null)
        }
      }
    }).catch(() => {
      if (!settled) {
        settled = true
        clearTimeout(timeoutId)
        resolve(null)
      }
    })
  })
}

/**
 * Convert an ImageBitmap to a JPEG data URL for use with encodeGif.
 * Closes the bitmap after conversion.
 */
export function bitmapToJpegDataUrl(bitmap: ImageBitmap, quality = 0.8): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) { reject(new Error('toBlob returned null')); return }
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}
