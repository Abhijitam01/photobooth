import { useEffect, useRef, useState } from 'react'
import type { AppAction } from '../types'
import { isGifAvailable } from '../lib/encodeGif'

interface Props {
  resultBlob: Blob
  gifBlob: Blob | null
  gifProgress: number
  dispatch: React.Dispatch<AppAction>
  onExportGif: () => void
  isKiosk: boolean
}

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? ''

async function uploadStrip(blob: Blob): Promise<string | null> {
  if (!WORKER_URL) return null
  try {
    const res = await fetch(`${WORKER_URL}/upload`, {
      method: 'POST',
      headers: { 'content-type': blob.type || 'image/png' },
      body: blob,
    })
    if (!res.ok) return null
    const json = await res.json() as { url?: string }
    return json.url ?? null
  } catch {
    return null
  }
}

const GIF_AVAILABLE = isGifAvailable()

export function ResultView({ resultBlob, gifBlob, gifProgress, dispatch, onExportGif, isKiosk }: Props) {
  const [stripUrl, setStripUrl] = useState<string | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [qrDataUri, setQrDataUri] = useState<string | null | 'loading'>('loading')
  const [shareState, setShareState] = useState<'idle' | 'uploading' | 'copied' | 'error'>('idle')
  const stripUrlRef = useRef<string | null>(null)
  const gifUrlRef = useRef<string | null>(null)

  // Create object URL for the strip
  useEffect(() => {
    const url = URL.createObjectURL(resultBlob)
    setStripUrl(url)
    stripUrlRef.current = url
    return () => {
      URL.revokeObjectURL(url)
      stripUrlRef.current = null
    }
  }, [resultBlob])

  // Create object URL for GIF
  useEffect(() => {
    if (!gifBlob) { setGifUrl(null); return }
    const url = URL.createObjectURL(gifBlob)
    setGifUrl(url)
    gifUrlRef.current = url
    return () => {
      URL.revokeObjectURL(url)
      gifUrlRef.current = null
    }
  }, [gifBlob])

  // Generate QR code
  useEffect(() => {
    setQrDataUri('loading')
    import('../lib/generateQR').then(({ generateQR }) =>
      generateQR(resultBlob)
    ).then(uri => {
      setQrDataUri(uri)
    }).catch(() => {
      setQrDataUri(null)
    })
  }, [resultBlob])

  const handleDownloadPng = () => {
    if (!stripUrl) return
    const a = document.createElement('a')
    a.href = stripUrl
    a.download = 'photobooth-strip.png'
    a.click()
  }

  const handleDownloadGif = () => {
    if (!gifUrl) return
    const a = document.createElement('a')
    a.href = gifUrl
    a.download = 'photobooth-strip.gif'
    a.click()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleNewSession = () => {
    dispatch({ type: 'RESET' })
  }

  const handleShare = async () => {
    setShareState('uploading')
    const shareUrl = await uploadStrip(resultBlob)
    if (!shareUrl) {
      setShareState('error')
      setTimeout(() => setShareState('idle'), 3000)
      return
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'My Photo Strip', url: shareUrl })
        setShareState('idle')
      } catch {
        // User cancelled or share failed — fall back to clipboard
        await navigator.clipboard.writeText(shareUrl).catch(() => {})
        setShareState('copied')
        setTimeout(() => setShareState('idle'), 3000)
      }
    } else {
      await navigator.clipboard.writeText(shareUrl).catch(() => {})
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 3000)
    }
  }

  const isExportingGif = gifProgress > 0 && gifProgress < 100

  return (
    <div
      id="print-target"
      className="flex flex-col items-center gap-6 py-8 px-4 w-full max-w-lg mx-auto"
    >
      {/* Strip preview */}
      {stripUrl && (
        <img
          src={stripUrl}
          alt="Photo booth strip"
          className="w-full rounded shadow-lg"
          style={{ maxWidth: 300 }}
        />
      )}

      {/* QR code */}
      {qrDataUri === 'loading' && (
        <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
          Generating QR code...
        </p>
      )}
      {qrDataUri && qrDataUri !== 'loading' && (
        <div className="flex flex-col items-center gap-2">
          <img src={qrDataUri} alt="QR code to download strip" width={220} height={220} />
          <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.75rem' }}>
            Scan to download on your phone
          </p>
        </div>
      )}
      {qrDataUri === null && (
        <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.75rem' }}>
          Image too large for QR — use Download
        </p>
      )}

      {/* GIF progress */}
      {isExportingGif && (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <div
            style={{
              background: 'var(--color-surface-2)',
              borderRadius: 9999,
              height: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${gifProgress}%`,
                height: '100%',
                background: 'var(--color-accent)',
                transition: 'width 0.2s ease',
              }}
              role="progressbar"
              aria-valuenow={gifProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="GIF encoding progress"
            />
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.75rem', textAlign: 'center' }}>
            Encoding GIF... {gifProgress}%
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={handleDownloadPng}
          aria-label="Download PNG"
          className="px-6 py-3 rounded-full font-medium"
          style={{
            background: 'var(--color-accent)',
            color: '#000',
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            minHeight: 48,
          }}
        >
          Download PNG
        </button>

        {WORKER_URL && (
          <button
            onClick={handleShare}
            disabled={shareState === 'uploading'}
            aria-label="Share strip"
            className="px-6 py-3 rounded-full font-medium"
            style={{
              background: 'var(--color-accent)',
              color: '#000',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              minHeight: 48,
              opacity: shareState === 'uploading' ? 0.7 : 1,
              cursor: shareState === 'uploading' ? 'wait' : 'pointer',
            }}
          >
            {shareState === 'uploading' ? 'Uploading...' : shareState === 'copied' ? 'Link copied!' : shareState === 'error' ? 'Share failed' : 'Share'}
          </button>
        )}

        {GIF_AVAILABLE && !gifBlob && !isExportingGif && (
          <button
            onClick={onExportGif}
            aria-label="Export GIF"
            className="px-6 py-3 rounded-full font-medium"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              border: '1px solid var(--color-accent)',
              minHeight: 48,
            }}
          >
            Export GIF
          </button>
        )}

        {gifBlob && (
          <button
            onClick={handleDownloadGif}
            aria-label="Download GIF"
            className="px-6 py-3 rounded-full font-medium"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              border: '1px solid var(--color-accent)',
              minHeight: 48,
            }}
          >
            Download GIF
          </button>
        )}

        {!isKiosk && (
          <button
            onClick={handlePrint}
            aria-label="Print strip"
            className="px-6 py-3 rounded-full font-medium"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              border: '1px solid var(--color-surface-2)',
              minHeight: 48,
            }}
          >
            Print
          </button>
        )}

        <button
          onClick={handleNewSession}
          aria-label="Start a new session"
          className="px-6 py-3 rounded-full font-medium"
          style={{
            background: 'transparent',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            border: '1px solid var(--color-surface-2)',
            minHeight: 48,
          }}
        >
          New Session
        </button>
      </div>
    </div>
  )
}
