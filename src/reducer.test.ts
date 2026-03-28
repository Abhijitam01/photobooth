import { describe, it, expect } from 'vitest'
import { reducer, initialState } from './reducer'
import type { AppStore } from './types'

describe('reducer', () => {
  describe('START_CAPTURE', () => {
    it('transitions IDLE → COUNTDOWN and clears errorMessage', () => {
      const state: AppStore = { ...initialState, state: 'IDLE', errorMessage: 'old error' }
      const next = reducer(state, { type: 'START_CAPTURE' })
      expect(next.state).toBe('COUNTDOWN')
      expect(next.errorMessage).toBeNull()
    })

    it('does nothing if not in IDLE state', () => {
      const state: AppStore = { ...initialState, state: 'COUNTDOWN' }
      const next = reducer(state, { type: 'START_CAPTURE' })
      expect(next).toBe(state) // same reference = no change
    })
  })

  describe('FRAME_CAPTURED', () => {
    it('increments frameCount and moves to CAPTURING before reaching required count', () => {
      const state: AppStore = { ...initialState, state: 'COUNTDOWN', layout: '4-strip', frameCount: 0 }
      const next = reducer(state, { type: 'FRAME_CAPTURED' })
      expect(next.state).toBe('CAPTURING')
      expect(next.frameCount).toBe(1)
    })

    it('transitions to COMPOSITING when frameCount reaches required count', () => {
      // 4-strip needs 4 frames; at count 3 → 4 triggers COMPOSITING
      const state: AppStore = { ...initialState, state: 'CAPTURING', layout: '4-strip', frameCount: 3 }
      const next = reducer(state, { type: 'FRAME_CAPTURED' })
      expect(next.state).toBe('COMPOSITING')
      expect(next.frameCount).toBe(4)
    })

    it('transitions to COMPOSITING for single layout at count 1', () => {
      const state: AppStore = { ...initialState, state: 'COUNTDOWN', layout: 'single', frameCount: 0 }
      const next = reducer(state, { type: 'FRAME_CAPTURED' })
      expect(next.state).toBe('COMPOSITING')
      expect(next.frameCount).toBe(1)
    })
  })

  describe('UPLOAD_IMAGES', () => {
    it('transitions IDLE → COMPOSITING, resets frameCount to 0', () => {
      const state: AppStore = { ...initialState, state: 'IDLE' }
      const next = reducer(state, { type: 'UPLOAD_IMAGES' })
      expect(next.state).toBe('COMPOSITING')
      expect(next.frameCount).toBe(0)
    })
  })

  describe('COMPOSITION_DONE', () => {
    it('transitions COMPOSITING → RESULT and stores blob', () => {
      const blob = new Blob(['test'], { type: 'image/png' })
      const state: AppStore = { ...initialState, state: 'COMPOSITING' }
      const next = reducer(state, { type: 'COMPOSITION_DONE', blob })
      expect(next.state).toBe('RESULT')
      expect(next.resultBlob).toBe(blob)
    })
  })

  describe('ERROR', () => {
    it('sets state to ERROR and stores errorMessage', () => {
      const state: AppStore = { ...initialState, state: 'CAPTURING' }
      const next = reducer(state, { type: 'ERROR', message: 'Camera failed' })
      expect(next.state).toBe('ERROR')
      expect(next.errorMessage).toBe('Camera failed')
    })
  })

  describe('RESET', () => {
    it('returns to IDLE and clears blobs/frames, preserves layout and filter', () => {
      const blob = new Blob(['test'])
      const state: AppStore = {
        ...initialState,
        state: 'RESULT',
        resultBlob: blob,
        gifBlob: blob,
        frameCount: 4,
        layout: '2x2',
        filter: 'bw',
        errorMessage: 'old',
      }
      const next = reducer(state, { type: 'RESET' })
      expect(next.state).toBe('IDLE')
      expect(next.resultBlob).toBeNull()
      expect(next.gifBlob).toBeNull()
      expect(next.frameCount).toBe(0)
      expect(next.errorMessage).toBeNull()
      // User preference preserved
      expect(next.layout).toBe('2x2')
      expect(next.filter).toBe('bw')
    })
  })

  describe('SET_LAYOUT', () => {
    it('updates layout and resets frameCount', () => {
      const state: AppStore = { ...initialState, layout: '4-strip', frameCount: 2 }
      const next = reducer(state, { type: 'SET_LAYOUT', layout: '2x2' })
      expect(next.layout).toBe('2x2')
      expect(next.frameCount).toBe(0)
    })
  })

  describe('SET_GIF_BLOB', () => {
    it('stores gif blob and sets gifProgress to 100', () => {
      const blob = new Blob(['gif-data'])
      const state: AppStore = { ...initialState, gifProgress: 80 }
      const next = reducer(state, { type: 'SET_GIF_BLOB', blob })
      expect(next.gifBlob).toBe(blob)
      expect(next.gifProgress).toBe(100)
    })
  })
})
