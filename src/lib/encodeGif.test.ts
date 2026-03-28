import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isGifAvailable, encodeGif } from './encodeGif'

describe('isGifAvailable', () => {
  it('returns true when Worker is defined', () => {
    expect(typeof Worker).toBe('function') // jsdom has Worker
    expect(isGifAvailable()).toBe(true)
  })

  it('returns false when Worker is undefined', () => {
    const original = (globalThis as Record<string, unknown>).Worker
    delete (globalThis as Record<string, unknown>).Worker
    expect(isGifAvailable()).toBe(false)
    ;(globalThis as Record<string, unknown>).Worker = original
  })
})

describe('encodeGif', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null immediately when Worker is unavailable', async () => {
    const original = (globalThis as Record<string, unknown>).Worker
    delete (globalThis as Record<string, unknown>).Worker

    const ctrl = new AbortController()
    const result = await encodeGif([], vi.fn(), ctrl.signal)
    expect(result).toBeNull()

    ;(globalThis as Record<string, unknown>).Worker = original
  })

  it('returns null for empty frame array', async () => {
    const ctrl = new AbortController()
    const result = await encodeGif([], vi.fn(), ctrl.signal)
    expect(result).toBeNull()
  })

  it('returns null when AbortSignal fires immediately', async () => {
    const ctrl = new AbortController()
    ctrl.abort()

    const progress = vi.fn()
    const result = await encodeGif(['data:image/jpeg;base64,/9j/fakeframe'], progress, ctrl.signal)
    expect(result).toBeNull()
    expect(progress).not.toHaveBeenCalled()
  })

  it('returns null when gif-encoder-2 import fails', async () => {
    vi.doMock('gif-encoder-2', () => {
      throw new Error('module not found')
    })

    const ctrl = new AbortController()
    // encodeGif catches the import failure and resolves null
    const result = await encodeGif(['data:image/jpeg;base64,/9j/x'], vi.fn(), ctrl.signal)
    expect(result).toBeNull()

    vi.doUnmock('gif-encoder-2')
  })

  it('returns null when 15s timeout fires (fake timers)', async () => {
    vi.useFakeTimers()

    const ctrl = new AbortController()
    const resultPromise = encodeGif(['data:image/jpeg;base64,/9j/x'], vi.fn(), ctrl.signal)

    // Advance past 15s timeout
    await vi.advanceTimersByTimeAsync(16_000)

    const result = await resultPromise
    expect(result).toBeNull()

    vi.useRealTimers()
  })
})
