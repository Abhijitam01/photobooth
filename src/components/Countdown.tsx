import { useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: () => void      // called at each capture moment
  onComplete: () => void     // called after all beats are done
  frameCount: number         // how many frames to capture total
  soundEnabled: boolean
  onToggleSound: () => void
}

const COUNTDOWN_FROM = 3
const BETWEEN_FRAMES_MS = 1500 // pause between frame captures

export function Countdown({ onCapture, onComplete, frameCount, soundEnabled, onToggleSound }: Props) {
  const [tick, setTick] = useState(COUNTDOWN_FROM)
  const [flash, setFlash] = useState(false)
  const [capturedSoFar, setCapturedSoFar] = useState(0)
  const [phase, setPhase] = useState<'counting' | 'capturing' | 'between'>('counting')
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playShutter = () => {
    if (!soundEnabled) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.08)
    } catch {
      // Audio unavailable — silent
    }
  }

  const triggerFlash = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 200)
  }

  useEffect(() => {
    // Initial countdown: 3 → 2 → 1, then capture first frame
    let remaining = COUNTDOWN_FROM
    const countInterval = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setTick(remaining)
      } else {
        clearInterval(countInterval)
        setPhase('capturing')
        // Capture first frame
        playShutter()
        triggerFlash()
        onCapture()
        setCapturedSoFar(1)

        if (frameCount <= 1) {
          onComplete()
          return
        }

        // Schedule remaining frames
        let captured = 1
        const frameInterval = setInterval(() => {
          playShutter()
          triggerFlash()
          onCapture()
          captured++
          setCapturedSoFar(captured)
          if (captured >= frameCount) {
            clearInterval(frameInterval)
            onComplete()
          }
        }, BETWEEN_FRAMES_MS)

        return () => clearInterval(frameInterval)
      }
    }, 1000)

    return () => clearInterval(countInterval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 10 }}
    >
      {/* Flash overlay */}
      {flash && (
        <div
          className="flash-overlay absolute inset-0"
          aria-hidden="true"
          style={{ background: 'white', opacity: 0.9, zIndex: 20 }}
        />
      )}

      {phase === 'counting' ? (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '6rem',
            color: 'white',
            fontWeight: 'bold',
            lineHeight: 1,
          }}
          aria-live="assertive"
          aria-atomic="true"
        >
          {tick}
        </div>
      ) : (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.25rem',
            color: 'white',
          }}
          aria-live="polite"
        >
          {capturedSoFar} / {frameCount}
        </div>
      )}

      {/* Sound toggle */}
      <button
        onClick={onToggleSound}
        aria-label={soundEnabled ? 'Mute shutter sound' : 'Unmute shutter sound'}
        className="absolute top-4 right-4 p-2 rounded-full"
        style={{
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          fontSize: '1.25rem',
          minWidth: 48,
          minHeight: 48,
        }}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>
    </div>
  )
}
