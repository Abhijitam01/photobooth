import { useRef, useState, useCallback } from 'react'
import type { Layout } from '../types'
import { LAYOUT_FRAME_COUNT } from '../types'

interface Props {
  layout: Layout
  onFiles: (bitmaps: ImageBitmap[]) => void
}

export function UploadZone({ layout, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const required = LAYOUT_FRAME_COUNT[layout]

  const processFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))

    if (imageFiles.length !== required) {
      setError(`Please select exactly ${required} image${required !== 1 ? 's' : ''} for the ${layout} layout`)
      return
    }

    setError(null)
    setLoading(true)

    try {
      const bitmaps = await Promise.all(imageFiles.map(f => createImageBitmap(f)))
      onFiles(bitmaps)
    } catch {
      setError('Could not load one or more images. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [required, layout, onFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  }, [processFiles])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    processFiles(files)
    // Reset input so the same files can be re-selected
    e.target.value = ''
  }, [processFiles])

  return (
    <div className="flex flex-col gap-4 w-full">
      <div
        role="region"
        aria-label="Upload photos"
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-4 p-8 rounded cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-surface-2)'}`,
          background: dragging ? 'rgba(245,166,35,0.05)' : 'var(--color-surface)',
          minHeight: 200,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleChange}
          aria-label="Choose image files"
          className="sr-only"
        />

        {loading ? (
          <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
            Loading images...
          </p>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-text)' }}>
              Drop photos here
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              or{' '}
              <span style={{ color: 'var(--color-accent)' }}>browse files</span>
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {required} image{required !== 1 ? 's' : ''} required for {layout}
            </p>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            color: 'var(--color-error)',
            background: 'var(--color-error-bg)',
            padding: '0.5rem 0.75rem',
            borderRadius: 4,
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
