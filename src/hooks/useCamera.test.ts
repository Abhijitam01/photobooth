import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCamera } from './useCamera'

function makeMockTrack(overrides: Partial<MediaStreamTrack> = {}): MediaStreamTrack {
  return {
    stop: vi.fn(),
    onended: null,
    ...overrides,
  } as unknown as MediaStreamTrack
}

function makeMockStream(tracks: MediaStreamTrack[] = []): MediaStream {
  const defaultTrack = makeMockTrack()
  const allTracks = tracks.length ? tracks : [defaultTrack]
  return {
    getTracks: () => allTracks,
  } as unknown as MediaStream
}

describe('useCamera', () => {
  let getUserMediaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUserMediaMock = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('sets permissionState to granted when getUserMedia resolves', async () => {
    const stream = makeMockStream()
    getUserMediaMock.mockResolvedValue(stream)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => expect(result.current.permissionState).toBe('granted'))
    expect(result.current.error).toBeNull()
  })

  it('sets permissionState to denied on NotAllowedError', async () => {
    const err = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
    getUserMediaMock.mockRejectedValue(err)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => expect(result.current.permissionState).toBe('denied'))
    expect(result.current.error).toBe('Camera access denied')
  })

  it('sets permissionState to unavailable on NotFoundError', async () => {
    const err = Object.assign(new Error('No device'), { name: 'NotFoundError' })
    getUserMediaMock.mockRejectedValue(err)

    const { result } = renderHook(() => useCamera())

    await waitFor(() => expect(result.current.permissionState).toBe('unavailable'))
    expect(result.current.error).toBe('No camera found')
  })

  it('sets permissionState to unavailable after 10s timeout', async () => {
    vi.useFakeTimers()
    // getUserMedia resolves after 12s — so the hook reaches the abort check after 10s fires
    getUserMediaMock.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(makeMockStream()), 12_000)),
    )

    const { result } = renderHook(() => useCamera())

    // Advance past 10s timeout (abort fires) and then past the 12s getUserMedia resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000)
    })

    expect(result.current.permissionState).toBe('unavailable')
  })

  it('retry() re-invokes getUserMedia', async () => {
    const stream = makeMockStream()
    getUserMediaMock.mockResolvedValue(stream)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.permissionState).toBe('granted'))

    const callsBefore = getUserMediaMock.mock.calls.length

    act(() => {
      result.current.retry()
    })

    await waitFor(() => expect(getUserMediaMock.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('sets error to "Camera disconnected" when track.onended fires', async () => {
    const track = makeMockTrack()
    const stream = makeMockStream([track])
    getUserMediaMock.mockResolvedValue(stream)

    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.permissionState).toBe('granted'))

    act(() => {
      if (track.onended) track.onended(new Event('ended'))
    })

    await waitFor(() => expect(result.current.error).toBe('Camera disconnected'))
  })
})
