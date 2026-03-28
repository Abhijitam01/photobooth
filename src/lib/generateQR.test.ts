import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateQR } from './generateQR'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async (data: string) => `data:image/png;base64,qr-${data.slice(0, 10)}`),
  },
}))

// Helper to create a blob whose data URI resolves to a string of given length
function makeBlobWithSize(byteLength: number): Blob {
  return new Blob([new Uint8Array(byteLength)], { type: 'image/png' })
}

// Stub FileReader to return controlled data URI lengths
function stubFileReader(dataUriLength: number) {
  const mockResult = 'x'.repeat(dataUriLength)
  class FakeFileReader {
    result: string = mockResult
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL(_blob: Blob) {
      this.result = mockResult
      setTimeout(() => this.onload?.(), 0)
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader)
}

// Stub canvas.toBlob to return a blob whose data URI is the given length
function stubCanvasToBlob(jpegDataUriLength: number) {
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      drawImage: vi.fn(),
    })),
    toBlob: vi.fn((cb: (b: Blob | null) => void) => {
      const jpegBlob = new Blob(['x'.repeat(jpegDataUriLength)], { type: 'image/jpeg' })
      cb(jpegBlob)
    }),
  }
  vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement)
}

describe('generateQR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns QR data URI when PNG is under 1MB', async () => {
    stubFileReader(500_000) // 0.5MB — under 1MB cap
    const blob = makeBlobWithSize(100)
    const result = await generateQR(blob)
    expect(result).toMatch(/^data:image\/png/)
  })

  it('returns null when all JPEG quality steps still exceed 1MB', async () => {
    // Simulate blob FileReader returning a 2MB string always
    const bigResult = 'x'.repeat(2_000_000)
    class BigFileReader {
      result: string = bigResult
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL(_blob: Blob) {
        this.result = bigResult
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('FileReader', BigFileReader)

    // Mock canvas for JPEG fallback — also returns 2MB
    stubCanvasToBlob(2_000_000)

    const blob = makeBlobWithSize(100)
    const result = await generateQR(blob)
    expect(result).toBeNull()
  })

  it('returns null when qrcode.toDataURL throws', async () => {
    const QRCode = await import('qrcode')
    vi.mocked(QRCode.default.toDataURL).mockRejectedValueOnce(new Error('QR encode failed'))
    stubFileReader(100) // small, won't fail on size check

    const blob = makeBlobWithSize(50)
    const result = await generateQR(blob)
    expect(result).toBeNull()
  })

  it('returns null when FileReader errors', async () => {
    class ErrorFileReader {
      result: null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL(_blob: Blob) {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    vi.stubGlobal('FileReader', ErrorFileReader)

    const blob = makeBlobWithSize(50)
    const result = await generateQR(blob)
    expect(result).toBeNull()
  })
})
