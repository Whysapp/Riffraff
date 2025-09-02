export class AudioEngine {
  public context: AudioContext;
  public gain: GainNode;
  private static instance: AudioEngine | null = null;

  private constructor() {
    this.context = new AudioContext();
    this.gain = this.context.createGain();
    this.gain.connect(this.context.destination);
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public async ensureResumed(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return await this.context.decodeAudioData(arrayBuffer.slice(0));
  }
}

export function getAudioEngine(): AudioEngine {
  return AudioEngine.getInstance();
}