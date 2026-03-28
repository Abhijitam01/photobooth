import { useEffect, useRef, useCallback } from 'react'
import type { FilterName } from '../types'
import { FILTER_CSS, FILTER_LABELS } from '../types'

const FILTER_NAMES: FilterName[] = ['none', 'bw', 'vintage', 'warm', 'cool']
const SWATCH_SIZE = 48

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  filter: FilterName
  onFilterChange: (f: FilterName) => void
}

export function CameraPreview({ videoRef, filter, onFilterChange }: Props) {
  return (
    <div className="flex flex-col w-full">
      {/* Camera preview — square crop */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Camera preview"
          className={`w-full h-full object-cover filter-${filter}`}
          style={{ display: 'block' }}
        />
      </div>

      {/* Filter swatches */}
      <div className="flex items-center justify-center gap-3 py-4 overflow-x-auto">
        {FILTER_NAMES.map(f => (
          <FilterSwatch
            key={f}
            filterName={f}
            videoRef={videoRef}
            selected={filter === f}
            onSelect={() => onFilterChange(f)}
          />
        ))}
      </div>
    </div>
  )
}

interface SwatchProps {
  filterName: FilterName
  videoRef: React.RefObject<HTMLVideoElement | null>
  selected: boolean
  onSelect: () => void
}

function FilterSwatch({ filterName, videoRef, selected, onSelect }: SwatchProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || video.readyState < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.filter = FILTER_CSS[filterName]
    ctx.drawImage(video, 0, 0, SWATCH_SIZE, SWATCH_SIZE)
    ctx.filter = 'none'
  }, [filterName, videoRef])

  useEffect(() => {
    // 10fps — NOT requestAnimationFrame (that would be 60fps × 5 swatches = too much)
    intervalRef.current = setInterval(drawFrame, 100)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [drawFrame])

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <button
        onClick={onSelect}
        aria-label={`${FILTER_LABELS[filterName]} filter`}
        aria-pressed={selected}
        className="rounded-full overflow-hidden transition-transform"
        style={{
          width: SWATCH_SIZE,
          height: SWATCH_SIZE,
          minWidth: SWATCH_SIZE,
          minHeight: SWATCH_SIZE,
          border: selected ? '2px solid var(--color-accent)' : '2px solid transparent',
          transform: selected ? 'scale(1.1)' : 'scale(1)',
          outline: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={SWATCH_SIZE}
          height={SWATCH_SIZE}
          aria-hidden="true"
          style={{ display: 'block' }}
        />
      </button>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.75rem',
        color: selected ? 'var(--color-accent)' : 'var(--color-text-muted)',
      }}>
        {FILTER_LABELS[filterName]}
      </span>
    </div>
  )
}
