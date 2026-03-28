import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ResultView } from './ResultView'

// Mock generateQR so we don't hit real QR logic in component tests
vi.mock('../lib/generateQR', () => ({
  generateQR: vi.fn(async () => 'data:image/png;base64,qr-mock'),
}))

// Mock encodeGif module — control GIF availability
vi.mock('../lib/encodeGif', () => ({
  isGifAvailable: vi.fn(() => true),
  encodeGif: vi.fn(),
}))

function makeBlob(content = 'png-data'): Blob {
  return new Blob([content], { type: 'image/png' })
}

function defaultProps(overrides = {}) {
  return {
    resultBlob: makeBlob(),
    gifBlob: null,
    gifProgress: 0,
    dispatch: vi.fn(),
    onExportGif: vi.fn(),
    isKiosk: false,
    ...overrides,
  }
}

describe('ResultView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the strip image with correct alt text', async () => {
    render(<ResultView {...defaultProps()} />)
    await waitFor(() => {
      const img = screen.getByAltText('Photo booth strip')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', 'blob:mock-url')
    })
  })

  it('shows Download PNG button that triggers anchor click', async () => {
    const clickSpy = vi.fn()
    const anchorEl = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return anchorEl
      return origCreateElement(tag)
    })

    render(<ResultView {...defaultProps()} />)
    await waitFor(() => screen.getByAltText('Photo booth strip'))

    fireEvent.click(screen.getByRole('button', { name: /download png/i }))
    expect(clickSpy).toHaveBeenCalled()
    expect(anchorEl.download).toBe('photobooth-strip.png')
  })

  it('dispatches RESET when New Session is clicked', async () => {
    const dispatch = vi.fn()
    render(<ResultView {...defaultProps({ dispatch })} />)
    await waitFor(() => screen.getByAltText('Photo booth strip'))

    fireEvent.click(screen.getByRole('button', { name: /new session/i }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESET' })
  })

  it('shows GIF progress bar when gifProgress is between 0 and 100', async () => {
    render(<ResultView {...defaultProps({ gifProgress: 50 })} />)
    await waitFor(() => screen.getByAltText('Photo booth strip'))

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText(/encoding gif/i)).toBeInTheDocument()
  })

  it('shows Download GIF button and hides Export GIF when gifBlob is set', async () => {
    const gifBlob = new Blob(['gif-data'], { type: 'image/gif' })
    render(<ResultView {...defaultProps({ gifBlob })} />)
    await waitFor(() => screen.getByAltText('Photo booth strip'))

    expect(screen.getByRole('button', { name: /download gif/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /export gif/i })).not.toBeInTheDocument()
  })

  it('hides Print button in kiosk mode', async () => {
    render(<ResultView {...defaultProps({ isKiosk: true })} />)
    await waitFor(() => screen.getByAltText('Photo booth strip'))

    expect(screen.queryByRole('button', { name: /print/i })).not.toBeInTheDocument()
  })

  it('shows "Image too large for QR" when generateQR returns null', async () => {
    const { generateQR } = await import('../lib/generateQR')
    vi.mocked(generateQR).mockResolvedValueOnce(null)

    render(<ResultView {...defaultProps()} />)
    await waitFor(() => {
      expect(screen.getByText(/image too large for qr/i)).toBeInTheDocument()
    })
  })

  it('shows QR code image when generateQR returns a data URI', async () => {
    render(<ResultView {...defaultProps()} />)
    await waitFor(() => {
      const qrImg = screen.getByAltText('QR code to download strip')
      expect(qrImg).toBeInTheDocument()
      expect(qrImg).toHaveAttribute('src', 'data:image/png;base64,qr-mock')
    })
  })
})
