import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  message: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? 'Unknown error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, message: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
           style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
          Something went wrong
        </p>
        {this.state.message && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {this.state.message}
          </p>
        )}
        <button
          onClick={this.handleReset}
          aria-label="Restart the app"
          className="px-8 py-3 rounded-full font-medium"
          style={{
            background: 'var(--color-accent)',
            color: '#000',
            fontFamily: 'var(--font-body)',
            fontSize: '1rem',
          }}
        >
          Restart
        </button>
      </div>
    )
  }
}
