import { useEffect, useState } from 'react'

interface Props {
  slug: string
}

type LoadState = 'loading' | 'loaded' | 'expired' | 'not-found' | 'error'

export function StripView({ slug }: Props) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const workerBase = import.meta.env.VITE_WORKER_URL ?? ''

  useEffect(() => {
    if (!workerBase) {
      setLoadState('error')
      return
    }

    const src = `${workerBase}/s/${slug}`

    // Pre-flight with fetch to catch 404/410 before handing to <img>
    fetch(src, { method: 'HEAD' })
      .then(res => {
        if (res.status === 410) { setLoadState('expired'); return }
        if (res.status === 404) { setLoadState('not-found'); return }
        if (!res.ok) { setLoadState('error'); return }
        setImageUrl(src)
        setLoadState('loaded')
      })
      .catch(() => setLoadState('error'))
  }, [slug, workerBase])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        padding: '2rem 1rem',
      }}
    >
      {/* Wordmark */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
          letterSpacing: '0.1em',
          color: 'var(--color-text-muted)',
          margin: 0,
        }}
      >
        PHOTOBOOTH
      </h1>

      {/* Strip image */}
      {loadState === 'loading' && (
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>
          Loading strip...
        </p>
      )}

      {loadState === 'loaded' && imageUrl && (
        <img
          src={imageUrl}
          alt="Shared photo booth strip"
          style={{
            maxWidth: 300,
            width: '100%',
            borderRadius: 4,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        />
      )}

      {loadState === 'expired' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-text)' }}>
            This strip has expired
          </p>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Strips are stored for 30 days.
          </p>
        </div>
      )}

      {(loadState === 'not-found' || loadState === 'error') && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-text)' }}>
            Strip not found
          </p>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            The link may be invalid or the strip may have expired.
          </p>
        </div>
      )}

      {/* CTA */}
      <a
        href="/"
        style={{
          display: 'inline-block',
          padding: '0.875rem 2rem',
          borderRadius: 9999,
          background: 'var(--color-accent)',
          color: '#000',
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: '1rem',
          textDecoration: 'none',
          minHeight: 48,
          lineHeight: '1.5rem',
        }}
      >
        Make Your Own — Free
      </a>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-muted)',
          fontSize: '0.75rem',
          textAlign: 'center',
          maxWidth: 280,
        }}
      >
        No signup. No install. Just a URL.
      </p>
    </div>
  )
}
