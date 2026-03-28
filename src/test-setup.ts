import '@testing-library/jest-dom'

// Mock URL.createObjectURL / revokeObjectURL (jsdom doesn't implement these)
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock createImageBitmap
global.createImageBitmap = vi.fn(async () => ({
  width: 640,
  height: 480,
  close: vi.fn(),
})) as unknown as typeof createImageBitmap

// Mock Worker (jsdom does not implement Worker)
if (typeof Worker === 'undefined') {
  class MockWorker {
    onmessage: null = null
    onerror: null = null
    postMessage() {}
    terminate() {}
  }
  global.Worker = MockWorker as unknown as typeof Worker
}

// Mock AudioContext
global.AudioContext = vi.fn(() => ({
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    frequency: { value: 0 },
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  })),
  currentTime: 0,
  destination: {},
})) as unknown as typeof AudioContext
