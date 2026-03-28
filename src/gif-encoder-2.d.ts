declare module 'gif-encoder-2' {
  import { EventEmitter } from 'events'

  class GifEncoder extends EventEmitter {
    constructor(
      width: number,
      height: number,
      algorithm?: string,
      useOptimizer?: boolean,
      totalFrames?: number,
    )
    setDelay(delay: number): void
    setRepeat(repeat: number): void
    setQuality(quality: number): void
    setFrameRate(fps: number): void
    addFrame(ctx: CanvasRenderingContext2D | ImageData): void
    start(): void
    finish(): void
    read(): Buffer | null
  }

  export default GifEncoder
}
