export interface FrameAnalysis {
  timestamp: number;
  frequency: number;
  amplitude: number;
}

import { getAudioEngine } from './audioEngine';

export class AudioProcessor {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private freqData: Float32Array;

  constructor() {
    // Use the singleton AudioEngine's context to prevent multiple contexts
    this.audioContext = getAudioEngine().context;
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.3;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.freqData = new Float32Array(this.analyser.frequencyBinCount);
  }

  async loadAudioFile(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  analyzeAudioBuffer(audioBuffer: AudioBuffer): FrameAnalysis[] {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const frameSize = 2048;
    const hopSize = 512;
    const results: FrameAnalysis[] = [];

    for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
      const frame = channelData.slice(i, i + frameSize);
      const pitch = this.detectPitch(frame, sampleRate);
      const timestamp = i / sampleRate;
      results.push({ timestamp, frequency: pitch, amplitude: this.getAmplitude(frame) });
    }

    return results;
  }

  private detectPitch(audioData: Float32Array, sampleRate: number): number {
    const minFreq = 80;
    const maxFreq = 1000;
    const minPeriod = Math.floor(sampleRate / maxFreq);
    const maxPeriod = Math.floor(sampleRate / minFreq);

    let bestCorrelation = 0;
    let bestPeriod = 0;

    for (let period = minPeriod; period < maxPeriod; period++) {
      let correlation = 0;
      for (let i = 0; i < audioData.length - period; i++) {
        correlation += audioData[i] * audioData[i + period];
      }
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
  }

  private getAmplitude(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    return Math.sqrt(sum / frame.length);
  }

  detectTempo(analysisResults: FrameAnalysis[]): number {
    const amplitudes = analysisResults.map((r) => r.amplitude);
    const peaks = this.findPeaks(amplitudes);
    if (peaks.length < 2) return 0;
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push((peaks[i] - peaks[i - 1]) * 0.512);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60 / avgInterval);
    if (!isFinite(bpm) || bpm <= 0 || bpm > 300) return 0;
    return bpm;
  }

  private findPeaks(data: number[]): number[] {
    const peaks: number[] = [];
    const maxVal = Math.max(...data);
    const threshold = maxVal * 0.3;
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > threshold) {
        peaks.push(i);
      }
    }
    return peaks;
  }
}

