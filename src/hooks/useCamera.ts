import { useEffect, useRef, useState, useCallback } from 'react'
import type { PermissionState } from '../types'

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  permissionState: PermissionState
  error: string | null
  retry: () => void
  toggleCamera: () => void
  facingMode: 'user' | 'environment'
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    // Clean up any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 10_000)

    let stream: MediaStream | null = null

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facing },
        audio: false,
      })

      if (abortController.signal.aborted) {
        stream.getTracks().forEach(t => t.stop())
        setPermissionState('unavailable')
        return
      }

      streamRef.current = stream
      setPermissionState('granted')
      setError(null)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // Handle camera disconnect
      stream.getTracks().forEach(track => {
        track.onended = () => {
          setError('Camera disconnected')
          setPermissionState('unknown')
        }
      })
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionState('denied')
          setError('Camera access denied')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setPermissionState('unavailable')
          setError('No camera found')
        } else if (abortController.signal.aborted) {
          setPermissionState('unavailable')
          setError(null) // Silent timeout — upload zone appears instead
        } else {
          setPermissionState('unavailable')
          setError(err.message)
        }
      }
    } finally {
      clearTimeout(timeoutId)
      // If something went wrong after stream was assigned, stop tracks
      if (stream && !streamRef.current) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [startCamera, facingMode])

  const retry = useCallback(() => {
    setPermissionState('unknown')
    setError(null)
    startCamera(facingMode)
  }, [startCamera, facingMode])

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [])

  return { videoRef, permissionState, error, retry, toggleCamera, facingMode }
}
