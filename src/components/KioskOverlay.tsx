interface Props {
  secondsRemaining: number
  onGoNow: () => void
  onStay: () => void
}

export function KioskOverlay({ secondsRemaining, onGoNow, onStay }: Props) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-end pb-12 gap-6"
      style={{
        background: 'rgba(0,0,0,0.75)',
        zIndex: 50,
      }}
      role="dialog"
      aria-label="Session ending soon"
      aria-modal="true"
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '1rem',
          color: 'var(--color-text-muted)',
        }}
      >
        New session in
      </p>

      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '4rem',
          color: 'var(--color-text)',
          lineHeight: 1,
        }}
        aria-live="polite"
        aria-atomic="true"
      >
        {secondsRemaining}s
      </p>

      <div className="flex gap-4">
        <button
          onClick={onGoNow}
          aria-label="Start new session now"
          className="px-8 py-3 rounded-full font-medium"
          style={{
            background: 'var(--color-accent)',
            color: '#000',
            fontFamily: 'var(--font-body)',
            fontSize: '1rem',
            minHeight: 48,
            minWidth: 120,
          }}
        >
          New Session
        </button>

        <button
          onClick={onStay}
          aria-label="Stay on current result"
          className="px-8 py-3 rounded-full font-medium"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            fontSize: '1rem',
            border: '1px solid var(--color-accent)',
            minHeight: 48,
            minWidth: 120,
          }}
        >
          Stay
        </button>
      </div>
    </div>
  )
}
