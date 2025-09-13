export class ClientStemSeparator {
  private audioContext: AudioContext;
  private sampleRate: number = 44100;
  
  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async separateStems(
    audioBuffer: AudioBuffer, 
    stemType: string,
    progressCallback?: (progress: number) => void
  ): Promise<AudioBuffer> {
    
    progressCallback?.(10);
    
    switch (stemType) {
      case 'vocals':
        return await this.isolateVocals(audioBuffer, progressCallback);
      case 'drums':
        return await this.isolateDrums(audioBuffer, progressCallback);
      case 'bass':
        return await this.isolateBass(audioBuffer, progressCallback);
      case 'other':
        return await this.isolateOther(audioBuffer, progressCallback);
      default:
        return audioBuffer; // Return original for 'all'
    }
  }

  private async isolateVocals(
    audioBuffer: AudioBuffer, 
    progressCallback?: (progress: number) => void
  ): Promise<AudioBuffer> {
    // Center channel extraction (vocals are usually centered)
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
    const centerChannel = new Float32Array(leftChannel.length);
    
    progressCallback?.(30);
    
    // Extract center channel (L+R)/2
    for (let i = 0; i < leftChannel.length; i++) {
      centerChannel[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }
    
    progressCallback?.(60);
    
    // Apply vocal-focused filtering
    const filteredVocals = await this.applyVocalFilter(centerChannel);
    
    progressCallback?.(90);
    
    // Create new AudioBuffer
    const vocalBuffer = this.audioContext.createBuffer(1, filteredVocals.length, audioBuffer.sampleRate);
    vocalBuffer.copyToChannel(new Float32Array(filteredVocals), 0);
    
    progressCallback?.(100);
    return vocalBuffer;
  }

  private async isolateDrums(
    audioBuffer: AudioBuffer,
    progressCallback?: (progress: number) => void
  ): Promise<AudioBuffer> {
    const channelData = audioBuffer.getChannelData(0);
    
    progressCallback?.(30);
    
    // Enhance percussive elements using onset detection
    const drumTrack = await this.enhancePercussive(channelData);
    
    progressCallback?.(70);
    
    // Apply drum-focused EQ (emphasize kick, snare frequencies)
    const filteredDrums = await this.applyDrumFilter(drumTrack);
    
    progressCallback?.(100);
    
    const drumBuffer = this.audioContext.createBuffer(1, filteredDrums.length, audioBuffer.sampleRate);
    drumBuffer.copyToChannel(new Float32Array(filteredDrums), 0);
    
    return drumBuffer;
  }

  private async isolateBass(
    audioBuffer: AudioBuffer,
    progressCallback?: (progress: number) => void
  ): Promise<AudioBuffer> {
    const channelData = audioBuffer.getChannelData(0);
    
    progressCallback?.(40);
    
    // Low-pass filter for bass frequencies (20-200 Hz)
    const bassTrack = await this.applyLowPassFilter(channelData, 200);
    
    progressCallback?.(80);
    
    // Enhance bass harmonics
    const enhancedBass = await this.enhanceBassHarmonics(bassTrack);
    
    progressCallback?.(100);
    
    const bassBuffer = this.audioContext.createBuffer(1, enhancedBass.length, audioBuffer.sampleRate);
    bassBuffer.copyToChannel(new Float32Array(enhancedBass), 0);
    
    return bassBuffer;
  }

  private async isolateOther(
    audioBuffer: AudioBuffer,
    progressCallback?: (progress: number) => void
  ): Promise<AudioBuffer> {
    // Remove vocals, drums, and bass to get "other" instruments
    const originalData = audioBuffer.getChannelData(0);
    
    progressCallback?.(25);
    const vocals = await this.isolateVocals(audioBuffer);
    
    progressCallback?.(50);
    const drums = await this.isolateDrums(audioBuffer);
    
    progressCallback?.(75);
    const bass = await this.isolateBass(audioBuffer);
    
    // Subtract isolated elements from original
    const otherTrack = new Float32Array(originalData.length);
    const vocalData = vocals.getChannelData(0);
    const drumData = drums.getChannelData(0);
    const bassData = bass.getChannelData(0);
    
    for (let i = 0; i < originalData.length; i++) {
      otherTrack[i] = originalData[i] - (vocalData[i] * 0.7) - (drumData[i] * 0.5) - (bassData[i] * 0.6);
      // Clamp to prevent overflow
      otherTrack[i] = Math.max(-1, Math.min(1, otherTrack[i]));
    }
    
    progressCallback?.(100);
    
    const otherBuffer = this.audioContext.createBuffer(1, otherTrack.length, audioBuffer.sampleRate);
    otherBuffer.copyToChannel(new Float32Array(otherTrack), 0);
    
    return otherBuffer;
  }

  // Helper Methods for Audio Processing

  private async applyVocalFilter(audioData: Float32Array): Promise<Float32Array> {
    // Band-pass filter for vocal frequencies (80-8000 Hz)
    return await this.applyBandPassFilter(audioData, 80, 8000);
  }

  private async applyDrumFilter(audioData: Float32Array): Promise<Float32Array> {
    // Emphasize drum frequencies (60-8000 Hz with peaks at kick/snare)
    const filtered = await this.applyBandPassFilter(audioData, 60, 8000);
    // Add emphasis at kick (60-100 Hz) and snare (150-250 Hz, 2-5 kHz)
    return this.addFrequencyEmphasis(filtered, [80, 200, 3500]);
  }

  private async applyLowPassFilter(audioData: Float32Array, cutoff: number): Promise<Float32Array> {
    // Simple low-pass filter implementation
    const filtered = new Float32Array(audioData.length);
    const rc = 1.0 / (cutoff * 2 * Math.PI);
    const dt = 1.0 / this.sampleRate;
    const alpha = dt / (rc + dt);
    
    filtered[0] = audioData[0];
    for (let i = 1; i < audioData.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (audioData[i] - filtered[i - 1]);
    }
    
    return filtered;
  }

  private async applyBandPassFilter(
    audioData: Float32Array, 
    lowFreq: number, 
    highFreq: number
  ): Promise<Float32Array> {
    // Apply high-pass then low-pass
    const highPassed = await this.applyHighPassFilter(audioData, lowFreq);
    return await this.applyLowPassFilter(highPassed, highFreq);
  }

  private async applyHighPassFilter(audioData: Float32Array, cutoff: number): Promise<Float32Array> {
    // Simple high-pass filter
    const filtered = new Float32Array(audioData.length);
    const rc = 1.0 / (cutoff * 2 * Math.PI);
    const dt = 1.0 / this.sampleRate;
    const alpha = rc / (rc + dt);
    
    filtered[0] = audioData[0];
    for (let i = 1; i < audioData.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + audioData[i] - audioData[i - 1]);
    }
    
    return filtered;
  }

  private enhancePercussive(audioData: Float32Array): Float32Array {
    // Enhance sudden amplitude changes (characteristic of drums)
    const enhanced = new Float32Array(audioData.length);
    const windowSize = 256;
    
    for (let i = windowSize; i < audioData.length - windowSize; i++) {
      const current = Math.abs(audioData[i]);
      const before = this.getRMS(audioData.slice(i - windowSize, i));
      const after = this.getRMS(audioData.slice(i, i + windowSize));
      
      // If current sample has higher energy than surroundings, enhance it
      if (current > before * 1.5 && current > after * 1.5) {
        enhanced[i] = audioData[i] * 2; // Amplify percussive hits
      } else {
        enhanced[i] = audioData[i] * 0.3; // Reduce non-percussive content
      }
    }
    
    return enhanced;
  }

  private enhanceBassHarmonics(audioData: Float32Array): Float32Array {
    // Add subtle harmonic enhancement for bass
    const enhanced = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      // Original signal
      enhanced[i] = audioData[i];
      
      // Add second harmonic (octave up) at low level
      if (i + Math.floor(this.sampleRate / 100) < audioData.length) {
        enhanced[i] += audioData[i + Math.floor(this.sampleRate / 100)] * 0.1;
      }
    }
    
    return enhanced;
  }

  private addFrequencyEmphasis(audioData: Float32Array, frequencies: number[]): Float32Array {
    // For now, just return the original data
    // In a more advanced implementation, we would use FFT to emphasize specific frequencies
    return audioData;
  }

  private getRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }
}