import type { AppStore, AppAction, Layout, FilterName } from './types'
import { LAYOUT_FRAME_COUNT } from './types'

export const initialState: AppStore = {
  state: 'IDLE',
  layout: '4-strip',
  filter: 'none',
  frameCount: 0,
  resultBlob: null,
  gifBlob: null,
  gifProgress: 0,
  overlayFile: null,
  errorMessage: null,
  kioskCountdown: null,
}

export function reducer(store: AppStore, action: AppAction): AppStore {
  switch (action.type) {
    case 'START_CAPTURE':
      if (store.state !== 'IDLE') return store
      return { ...store, state: 'COUNTDOWN', errorMessage: null }

    case 'FRAME_CAPTURED': {
      if (store.state !== 'COUNTDOWN' && store.state !== 'CAPTURING') return store
      const nextCount = store.frameCount + 1
      const required = LAYOUT_FRAME_COUNT[store.layout]
      if (nextCount >= required) {
        return { ...store, state: 'COMPOSITING', frameCount: nextCount }
      }
      return { ...store, state: 'CAPTURING', frameCount: nextCount }
    }

    case 'START_COMPOSITING':
      return { ...store, state: 'COMPOSITING' }

    case 'UPLOAD_IMAGES':
      if (store.state !== 'IDLE') return store
      return { ...store, state: 'COMPOSITING', frameCount: 0, errorMessage: null }

    case 'COMPOSITION_DONE':
      return {
        ...store,
        state: 'RESULT',
        resultBlob: action.blob,
        gifBlob: null,
        gifProgress: 0,
      }

    case 'ERROR':
      return { ...store, state: 'ERROR', errorMessage: action.message }

    case 'RESET':
      return {
        ...initialState,
        // Preserve user preferences across sessions
        layout: store.layout,
        filter: store.filter,
      }

    case 'SET_LAYOUT':
      return { ...store, layout: action.layout as Layout, frameCount: 0 }

    case 'SET_FILTER':
      return { ...store, filter: action.filter as FilterName }

    case 'SET_OVERLAY':
      return { ...store, overlayFile: action.file }

    case 'SET_GIF_BLOB':
      return { ...store, gifBlob: action.blob, gifProgress: 100 }

    case 'SET_GIF_PROGRESS':
      return { ...store, gifProgress: action.progress }

    case 'SET_KIOSK_COUNTDOWN':
      return { ...store, kioskCountdown: action.seconds }

    default:
      return store
  }
}
