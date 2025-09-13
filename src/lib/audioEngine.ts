// src/lib/audioEngine.ts
/* A resilient, singleton Web Audio engine for decoding + playback. */
let _engine: AudioEngine | null = null;

export type AudioSource =
  | { type: "buffer"; buffer: AudioBuffer }
  | { type: "url"; url: string } // will be fetched and decoded
  | { type: "blob"; blob: Blob }; // from worker or export

export class AudioEngine {
  private ctx: AudioContext;
  private gain: GainNode;
  private srcNode: AudioBufferSourceNode | null = null;
  private _buffer: AudioBuffer | null = null;
  private _ready = false;
  private _startedAt = 0;
  private _pausedAt = 0;

  private constructor() {
    // Defer sampleRate; let browser decide. Create lazily on first user gesture.
    // But for SSR safety, guard window.
    const AC = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    // modest default volume
    this.gain.gain.value = 1.0;
    console.debug("[AudioEngine] Created singleton instance", { state: this.ctx.state });
  }

  static get(): AudioEngine {
    if (!_engine) _engine = new AudioEngine();
    return _engine;
  }

  get context() {
    return this.ctx;
  }
  get ready() {
    return this._ready && !!this._buffer;
  }
  get buffer() {
    return this._buffer;
  }
  get state(): AudioContextState {
    return this.ctx.state;
  }

  async ensureResumed(): Promise<void> {
    console.debug("[AudioEngine] ensureResumed called", { state: this.ctx.state });
    if (this.ctx.state !== "running") {
      console.debug("[AudioEngine] Resuming AudioContext...");
      await this.ctx.resume();
      // Small delay gives Safari a beat to settle
      await new Promise((r) => setTimeout(r, 0));
      console.debug("[AudioEngine] AudioContext resumed", { state: this.ctx.state });
    }
  }

  setVolume(v: number) {
    const clampedVolume = Math.max(0, Math.min(1, v));
    this.gain.gain.setValueAtTime(clampedVolume, this.ctx.currentTime);
    console.debug("[AudioEngine] Volume set to", clampedVolume);
  }

  async load(source: AudioSource): Promise<void> {
    console.debug("[AudioEngine] Loading audio source", { type: source.type });
    await this.ensureResumed();
    // Stop any current playback
    this.stopInternal(false);

    if (source.type === "buffer") {
      this._buffer = source.buffer;
      this._ready = true;
      console.debug("[AudioEngine] Buffer loaded directly", { 
        duration: this._buffer.duration, 
        sampleRate: this._buffer.sampleRate,
        channels: this._buffer.numberOfChannels 
      });
      return;
    }

    let arrayBuf: ArrayBuffer;
    if (source.type === "blob") {
      console.debug("[AudioEngine] Loading from blob", { size: source.blob.size });
      arrayBuf = await source.blob.arrayBuffer();
    } else {
      console.debug("[AudioEngine] Fetching from URL", { url: source.url.slice(0, 80) });
      const res = await fetch(source.url);
      if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
      arrayBuf = await res.arrayBuffer();
    }

    console.debug("[AudioEngine] Decoding audio data", { size: arrayBuf.byteLength });
    this._buffer = await this.ctx.decodeAudioData(arrayBuf.slice(0));
    this._ready = true;
    console.debug("[AudioEngine] Audio decoded successfully", {
      duration: this._buffer.duration,
      sampleRate: this._buffer.sampleRate,
      channels: this._buffer.numberOfChannels
    });
  }

  private createSource(): AudioBufferSourceNode {
    if (!this._buffer) throw new Error("No buffer loaded");
    const node = this.ctx.createBufferSource();
    node.buffer = this._buffer;
    node.connect(this.gain);
    node.onended = () => {
      console.debug("[AudioEngine] Playback ended naturally");
      // cleanup when finished to avoid reusing a one-shot node
      if (this.srcNode) {
        this.srcNode.disconnect();
        this.srcNode = null;
      }
      this._startedAt = 0;
      this._pausedAt = 0;
    };
    return node;
  }

  async play(): Promise<void> {
    console.debug("[AudioEngine] Play requested", { ready: this._ready, paused: this._pausedAt });
    await this.ensureResumed();
    if (!this._buffer) throw new Error("No audio loaded");
    // Always create a fresh one-shot source
    this.srcNode = this.createSource();

    const offset = this._pausedAt || 0;
    console.debug("[AudioEngine] Starting playback", { offset });
    this.srcNode.start(0, offset);
    this._startedAt = this.ctx.currentTime - offset;
    this._pausedAt = 0;
  }

  pause(): void {
    console.debug("[AudioEngine] Pause requested");
    if (!this.srcNode) return;
    const elapsed = this.ctx.currentTime - this._startedAt;
    this._pausedAt = Math.max(0, elapsed);
    console.debug("[AudioEngine] Paused at", this._pausedAt);
    this.stopInternal(true);
  }

  stop(): void {
    console.debug("[AudioEngine] Stop requested");
    this._pausedAt = 0;
    this.stopInternal(false);
  }

  private stopInternal(preservePaused: boolean): void {
    if (this.srcNode) {
      try {
        this.srcNode.stop();
        console.debug("[AudioEngine] Source stopped");
      } catch (e) {
        console.debug("[AudioEngine] Source stop failed (already stopped)", e);
      }
      this.srcNode.disconnect();
      this.srcNode = null;
    }
    if (!preservePaused) {
      this._startedAt = 0;
    }
  }
}

export function getAudioEngine(): AudioEngine {
  return AudioEngine.get();
}

// Helper to build an AudioBuffer from interleaved or per-channel Float32Arrays
export function floatToAudioBuffer(ctx: AudioContext, channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buffer = ctx.createBuffer(channels.length, channels[0].length, sampleRate);
  channels.forEach((ch, i) => buffer.getChannelData(i).set(ch));
  return buffer;
}