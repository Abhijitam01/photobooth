// Core state machine types
export type AppState =
  | 'IDLE'
  | 'COUNTDOWN'
  | 'CAPTURING'
  | 'COMPOSITING'
  | 'RESULT'
  | 'ERROR'

export type Layout = '4-strip' | '2x2' | '3-strip' | 'single'
export type FilterName = 'none' | 'bw' | 'vintage' | 'warm' | 'cool'
export type PermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable'

// Single source of truth for filter CSS values.
// These values are also used as CSS class suffixes in index.css (.filter-bw, etc.)
// and applied via ctx.filter in composeStrip.ts.
export const FILTER_CSS: Record<FilterName, string> = {
  none: 'none',
  bw: 'grayscale(100%)',
  vintage: 'sepia(60%) contrast(110%) brightness(90%)',
  warm: 'saturate(130%) hue-rotate(-10deg) brightness(105%)',
  cool: 'saturate(90%) hue-rotate(20deg) brightness(98%)',
}

export const FILTER_LABELS: Record<FilterName, string> = {
  none: 'None',
  bw: 'B&W',
  vintage: 'Vintage',
  warm: 'Warm',
  cool: 'Cool',
}

// Canvas dimensions per layout (in pixels)
export const LAYOUT_DIMENSIONS: Record<Layout, { w: number; h: number }> = {
  '4-strip': { w: 600, h: 2400 },
  '2x2':     { w: 1200, h: 1200 },
  '3-strip': { w: 600, h: 1800 },
  'single':  { w: 600, h: 600 },
}

// Frame count required per layout
export const LAYOUT_FRAME_COUNT: Record<Layout, number> = {
  '4-strip': 4,
  '2x2':     4,
  '3-strip': 3,
  'single':  1,
}

// App state stored in useReducer.
// NOTE: capturedFrames is intentionally NOT stored in reducer — it lives in a useRef
// in App.tsx to avoid non-serializable state and Strict Mode double-append issues.
export interface AppStore {
  state: AppState
  layout: Layout
  filter: FilterName
  frameCount: number          // count of captured frames (mirrors the useRef array length)
  resultBlob: Blob | null
  gifBlob: Blob | null
  gifProgress: number         // 0-100
  overlayFile: File | null
  errorMessage: string | null
  kioskCountdown: number | null  // seconds remaining in kiosk auto-reset timer
}

// Action union type for the reducer
export type AppAction =
  | { type: 'START_CAPTURE' }
  | { type: 'FRAME_CAPTURED' }
  | { type: 'START_COMPOSITING' }
  | { type: 'COMPOSITION_DONE'; blob: Blob }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' }
  | { type: 'UPLOAD_IMAGES' }
  | { type: 'SET_LAYOUT'; layout: Layout }
  | { type: 'SET_FILTER'; filter: FilterName }
  | { type: 'SET_OVERLAY'; file: File | null }
  | { type: 'SET_GIF_BLOB'; blob: Blob }
  | { type: 'SET_GIF_PROGRESS'; progress: number }
  | { type: 'SET_KIOSK_COUNTDOWN'; seconds: number | null }
