import { useReducer, useRef, useCallback, useEffect, useState } from 'react'
import { reducer, initialState } from './reducer'
import { useCamera } from './hooks/useCamera'
import { composeStrip } from './lib/composeStrip'
import { encodeGif, bitmapToJpegDataUrl, isGifAvailable } from './lib/encodeGif'
import { CameraPreview } from './components/CameraPreview'
import { Countdown } from './components/Countdown'
import { ResultView } from './components/ResultView'
import { UploadZone } from './components/UploadZone'
import { KioskOverlay } from './components/KioskOverlay'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { Layout, FilterName } from './types'
import { LAYOUT_FRAME_COUNT } from './types'

const KIOSK_TIMEOUT_S = 30
const isKiosk = new URLSearchParams(window.location.search).has('kiosk')

export default function App() {
  const [store, dispatch] = useReducer(reducer, initialState)
  const capturedFramesRef = useRef<ImageBitmap[]>([])
  const jpegFramesRef = useRef<string[]>([])
  const gifAbortRef = useRef<AbortController | null>(null)
  const kioskTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const { videoRef, permissionState, error: cameraError, retry: retryCamera, toggleCamera } = useCamera()

  // --- Capture flow ---

  const captureFrame = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const bitmap = await createImageBitmap(video)
    capturedFramesRef.current.push(bitmap)
    dispatch({ type: 'FRAME_CAPTURED' })
  }, [videoRef])

  // When reducer transitions to COMPOSITING, run composeStrip
  useEffect(() => {
    if (store.state !== 'COMPOSITING') return

    const frames = capturedFramesRef.current
    if (frames.length === 0) return

    composeStrip(frames, store.layout, store.filter, store.overlayFile).then(blob => {
      dispatch({ type: 'COMPOSITION_DONE', blob })
    }).catch(err => {
      dispatch({ type: 'ERROR', message: err?.message ?? 'Composition failed' })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state])

  // --- GIF export ---

  const handleExportGif = useCallback(async () => {
    if (!store.resultBlob) return
    if (!isGifAvailable()) return

    const frames = capturedFramesRef.current
    if (frames.length === 0) return

    // Convert bitmaps to JPEG data URLs (cached after first conversion)
    if (jpegFramesRef.current.length === 0) {
      try {
        const jpegUrls = await Promise.all(
          frames.map(async bm => {
            const clone = await createImageBitmap(bm)
            return bitmapToJpegDataUrl(clone)
          })
        )
        jpegFramesRef.current = jpegUrls
      } catch {
        dispatch({ type: 'ERROR', message: 'Could not prepare frames for GIF export' })
        return
      }
    }

    const abortCtrl = new AbortController()
    gifAbortRef.current = abortCtrl

    dispatch({ type: 'SET_GIF_PROGRESS', progress: 1 })

    const blob = await encodeGif(
      jpegFramesRef.current,
      p => dispatch({ type: 'SET_GIF_PROGRESS', progress: p }),
      abortCtrl.signal,
    )

    if (blob) {
      dispatch({ type: 'SET_GIF_BLOB', blob })
    } else {
      dispatch({ type: 'SET_GIF_PROGRESS', progress: 0 })
    }
  }, [store.resultBlob])

  // --- Upload flow ---

  const handleUploadFiles = useCallback(async (bitmaps: ImageBitmap[]) => {
    capturedFramesRef.current = bitmaps
    jpegFramesRef.current = []
    dispatch({ type: 'UPLOAD_IMAGES' })
  }, [])

  // --- Kiosk timer ---

  const clearKioskTimer = useCallback(() => {
    if (kioskTimerRef.current) {
      clearInterval(kioskTimerRef.current)
      kioskTimerRef.current = null
    }
    dispatch({ type: 'SET_KIOSK_COUNTDOWN', seconds: null })
  }, [])

  const resetSession = useCallback(() => {
    clearKioskTimer()
    gifAbortRef.current?.abort()
    gifAbortRef.current = null

    // Explicit cleanup — prevents memory accumulation across kiosk sessions
    capturedFramesRef.current.forEach(bm => bm.close())
    capturedFramesRef.current = []
    jpegFramesRef.current = []

    dispatch({ type: 'RESET' })
  }, [clearKioskTimer])

  useEffect(() => {
    if (!isKiosk || store.state !== 'RESULT') {
      clearKioskTimer()
      return
    }

    let remaining = KIOSK_TIMEOUT_S
    dispatch({ type: 'SET_KIOSK_COUNTDOWN', seconds: remaining })

    kioskTimerRef.current = setInterval(() => {
      remaining -= 1
      dispatch({ type: 'SET_KIOSK_COUNTDOWN', seconds: remaining })
      if (remaining <= 0) {
        resetSession()
      }
    }, 1000)

    return clearKioskTimer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.state])

  // Spacebar triggers capture from IDLE
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && store.state === 'IDLE' && permissionState === 'granted') {
        e.preventDefault()
        dispatch({ type: 'START_CAPTURE' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [store.state, permissionState])

  // --- Render ---

  const { state, layout, filter, resultBlob, gifBlob, gifProgress, kioskCountdown } = store

  return (
    <ErrorBoundary onReset={resetSession}>
      <div
        id="app"
        className="min-h-screen flex flex-col"
        style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              letterSpacing: '0.05em',
              color: 'var(--color-text)',
            }}
          >
            PHOTOBOOTH
          </h1>
          <div className="flex items-center gap-2">
            {permissionState === 'granted' && (
              <button
                onClick={toggleCamera}
                aria-label="Toggle front/rear camera"
                className="p-2 rounded-full"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  minWidth: 48,
                  minHeight: 48,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.125rem',
                }}
              >
                ⟳
              </button>
            )}
            <select
              value={layout}
              onChange={e => dispatch({ type: 'SET_LAYOUT', layout: e.target.value as Layout })}
              aria-label="Select layout"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-surface-2)',
                borderRadius: 4,
                padding: '0.375rem 0.5rem',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                minHeight: 48,
              }}
            >
              <option value="4-strip">4-Strip</option>
              <option value="2x2">2×2</option>
              <option value="3-strip">3-Strip</option>
              <option value="single">Single</option>
            </select>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center">
          {/* ERROR state */}
          {state === 'ERROR' && (
            <div className="flex flex-col items-center gap-6 py-12 px-6 text-center">
              <p
                style={{
                  color: 'var(--color-error)',
                  background: 'var(--color-error-bg)',
                  padding: '0.75rem 1rem',
                  borderRadius: 4,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {store.errorMessage ?? 'Something went wrong'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => dispatch({ type: 'START_CAPTURE' })}
                  aria-label="Try again"
                  className="px-6 py-3 rounded-full"
                  style={{
                    background: 'var(--color-accent)',
                    color: '#000',
                    fontFamily: 'var(--font-body)',
                    minHeight: 48,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
                <button
                  onClick={resetSession}
                  aria-label="Start over"
                  className="px-6 py-3 rounded-full"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                    border: '1px solid var(--color-surface-2)',
                    minHeight: 48,
                    cursor: 'pointer',
                  }}
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {/* RESULT state */}
          {state === 'RESULT' && resultBlob && (
            <>
              <ResultView
                resultBlob={resultBlob}
                gifBlob={gifBlob}
                gifProgress={gifProgress}
                dispatch={dispatch}
                onExportGif={handleExportGif}
                isKiosk={isKiosk}
              />
              {isKiosk && kioskCountdown !== null && (
                <KioskOverlay
                  secondsRemaining={kioskCountdown}
                  onGoNow={resetSession}
                  onStay={clearKioskTimer}
                />
              )}
            </>
          )}

          {/* COMPOSITING state */}
          {state === 'COMPOSITING' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--color-text)' }}>
                Developing...
              </p>
            </div>
          )}

          {/* IDLE / COUNTDOWN / CAPTURING states */}
          {(state === 'IDLE' || state === 'COUNTDOWN' || state === 'CAPTURING') && (
            <div className="flex flex-col w-full max-w-lg mx-auto px-4 gap-4">
              {permissionState === 'granted' && (
                <div className="relative w-full">
                  <CameraPreview
                    videoRef={videoRef}
                    filter={filter}
                    onFilterChange={(f: FilterName) => dispatch({ type: 'SET_FILTER', filter: f })}
                  />

                  {(state === 'COUNTDOWN' || state === 'CAPTURING') && (
                    <Countdown
                      onCapture={captureFrame}
                      onComplete={() => {}}
                      frameCount={LAYOUT_FRAME_COUNT[layout]}
                      soundEnabled={soundEnabled}
                      onToggleSound={() => setSoundEnabled(s => !s)}
                    />
                  )}
                </div>
              )}

              {(permissionState === 'denied' || permissionState === 'unavailable') && (
                <div
                  className="rounded p-4 flex flex-col gap-3"
                  role="alert"
                  style={{ background: 'var(--color-error-bg)', borderRadius: 4 }}
                >
                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-error)' }}>
                    {cameraError ?? 'Camera unavailable'}. You can still make a strip from your photos.
                  </p>
                  <button
                    onClick={retryCamera}
                    style={{
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                    }}
                  >
                    Retry Camera
                  </button>
                </div>
              )}

              {(permissionState === 'denied' || permissionState === 'unavailable') && (
                <UploadZone layout={layout} onFiles={handleUploadFiles} />
              )}

              {/* Overlay upload */}
              <div className="flex items-center gap-3">
                <label
                  htmlFor="overlay-input"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {store.overlayFile ? `Overlay: ${store.overlayFile.name}` : 'Add frame overlay (optional)'}
                </label>
                <input
                  id="overlay-input"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null
                    dispatch({ type: 'SET_OVERLAY', file: f })
                    e.target.value = ''
                  }}
                  aria-label="Upload overlay image"
                />
              </div>

              {/* Capture button */}
              {permissionState === 'granted' && state === 'IDLE' && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => dispatch({ type: 'START_CAPTURE' })}
                    aria-label="Start photo capture countdown"
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: 'var(--color-accent)',
                      border: '4px solid var(--color-text)',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Rotate prompt for phones in landscape */}
      <div
        id="rotate-prompt"
        style={{ display: 'none' }}
        className="fixed inset-0 items-center justify-center flex-col gap-4"
        aria-live="polite"
      >
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--color-text)' }}>
          Please rotate to portrait
        </p>
        <p style={{ fontSize: '3rem' }}>↕</p>
      </div>
    </ErrorBoundary>
  )
}
