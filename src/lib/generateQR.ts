import QRCode from 'qrcode'

const MAX_QR_BYTES = 1_000_000 // 1MB
const JPEG_QUALITY_STEPS = [0.7, 0.5, 0.3]

/**
 * Generate a QR code data URI for the given blob.
 * Returns null if:
 *   - The blob cannot be reduced below 1MB even at minimum JPEG quality
 *   - qrcode generation throws for any reason
 */
export async function generateQR(blob: Blob): Promise<string | null> {
  try {
    // Try PNG first
    const pngDataUri = await blobToDataUri(blob)
    if (pngDataUri.length <= MAX_QR_BYTES) {
      return await encodeQR(pngDataUri)
    }

    // PNG too large — try JPEG at progressively lower quality
    for (const quality of JPEG_QUALITY_STEPS) {
      const jpegDataUri = await blobToJpegDataUri(blob, quality)
      if (jpegDataUri.length <= MAX_QR_BYTES) {
        return await encodeQR(jpegDataUri)
      }
    }

    // All attempts exceeded 1MB — no QR
    return null
  } catch {
    return null
  }
}

async function encodeQR(dataUri: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(dataUri, { width: 220, margin: 1, errorCorrectionLevel: 'L' })
  } catch {
    return null
  }
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function blobToJpegDataUri(blob: Blob, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      jpegBlob => {
        if (!jpegBlob) { reject(new Error('toBlob returned null')); return }
        blobToDataUri(jpegBlob).then(resolve).catch(reject)
      },
      'image/jpeg',
      quality,
    )
  })
}
