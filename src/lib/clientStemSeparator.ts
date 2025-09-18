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
    
    console.log(`🎵 Starting stem separation for: ${stemType}`);
    console.log('Input AudioBuffer:', {
      duration: audioBuffer.duration,
      channels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate,
      length: audioBuffer.length,
      firstSamples: Array.from(audioBuffer.getChannelData(0).slice(0, 10))
    });
    
    progressCallback?.(10);
    
    let processedBuffer: AudioBuffer;
    
    switch (stemType) {
      case 'vocals':
        processedBuffer = await this.isolateVocals(audioBuffer, progressCallback);
        break;
      case 'drums':
        processedBuffer = await this.isolateDrums(audioBuffer, progressCallback);
        break;
      case 'bass':
        processedBuffer = await this.isolateBass(audioBuffer, progressCallback);
        break;
      case 'other':
        processedBuffer = await this.isolateOther(audioBuffer, progressCallback);
        break;
      default:
        processedBuffer = audioBuffer; // Return original for 'all'
    }
    
    console.log(`✅ ${stemType} separation complete:`, {
      duration: processedBuffer.duration,
      channels: processedBuffer.numberOfChannels,
      sampleRate: processedBuffer.sampleRate,
      length: processedBuffer.length,
      firstSamples: Array.from(processedBuffer.getChannelData(0).slice(0, 10))
    });
    
    // Verify the audio is actually different
    if (stemType !== 'all') {
      const originalSamples = audioBuffer.getChannelData(0).slice(0, 100);
      const processedSamples = processedBuffer.getChannelData(0).slice(0, 100);
      const difference = this.calculateAudioDifference(originalSamples, processedSamples);
      console.log(`📊 Audio difference for ${stemType}: ${(difference * 100).toFixed(2)}%`);
      
      if (difference < 0.01) {
        console.warn(`⚠️  Warning: ${stemType} separation may not be working - very low difference from original`);
      }
    }
    
    progressCallback?.(100);
    return processedBuffer;
  }

  private async isolateVocals(
    audioBuffer: AudioBuffer, 
    progressCallback?: (progress: number) => void
  ): Promise<AudioBuffer> {
    console.log('🎤 Isolating vocals...');
    
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
    
    progressCallback?.(20);
    
    // IMPROVED VOCAL ISOLATION:
    // 1. Center channel extraction with stereo width analysis
    const vocalChannel = new Float32Array(leftChannel.length);
    
    for (let i = 0; i < leftChannel.length; i++) {
      // Enhanced center extraction
      const center = (leftChannel[i] + rightChannel[i]) * 0.5;
      const side = (leftChannel[i] - rightChannel[i]) * 0.5;
      
      // Vocals are typically centered, so emphasize center content
      // and reduce side content more aggressively
      vocalChannel[i] = center * 1.2 - side * 0.7;
      
      // Clamp to prevent distortion
      vocalChannel[i] = Math.max(-1, Math.min(1, vocalChannel[i]));
    }
    
    progressCallback?.(50);
    
    // 2. Apply vocal frequency band-pass filter (fundamental + harmonics)
    const filteredVocals = await this.applyBandPassFilter(vocalChannel, 85, 8000);
    
    progressCallback?.(70);
    
    // 3. Enhance vocal formants (typical vocal resonances)
    const enhancedVocals = this.enhanceVocalFormants(filteredVocals);
    
    progressCallback?.(90);
    
    // 4. Apply dynamic range compression (vocals are often compressed)
    const compressedVocals = this.applyCompression(enhancedVocals, 0.3);
    
    // Create new AudioBuffer
    const vocalBuffer = this.audioContext.createBuffer(1, compressedVocals.length, audioBuffer.sampleRate);
    vocalBuffer.copyToChannel(new Float32Array(compressedVocals), 0);
    
    console.log('🎤 Vocal isolation complete - applied center extraction, band-pass, formant enhancement, and compression');
    return vocalBuffer;
  }

  private async isolateDrums(
    audioBuffer: AudioBuffer,
    progressCallback?: (progress: number) => void
  ): Promise<AudioBuffer> {
    console.log('🥁 Isolating drums...');
    
    const channelData = audioBuffer.getChannelData(0);
    
    progressCallback?.(20);
    
    // IMPROVED DRUM ISOLATION:
    // 1. Aggressive transient detection and enhancement
    const drumTrack = this.enhancePercussiveAggressive(channelData);
    
    progressCallback?.(40);
    
    // 2. Apply multi-band drum EQ
    // Kick: 40-100Hz, Snare: 150-250Hz + 2-5kHz, Hi-hats: 8-15kHz
    const kickEnhanced = await this.applyBandPassFilter(drumTrack, 40, 120);
    const snareEnhanced = await this.applyBandPassFilter(drumTrack, 150, 5000);
    const hatsEnhanced = await this.applyHighPassFilter(drumTrack, 8000);
    
    progressCallback?.(60);
    
    // 3. Combine drum elements with proper weighting
    const combinedDrums = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      combinedDrums[i] = 
        kickEnhanced[i] * 1.5 +      // Emphasize kick
        snareEnhanced[i] * 1.2 +    // Emphasize snare
        hatsEnhanced[i] * 0.8;      // Moderate hi-hats
      
      // Clamp to prevent distortion
      combinedDrums[i] = Math.max(-1, Math.min(1, combinedDrums[i]));
    }
    
    progressCallback?.(80);
    
    // 4. Apply gate to reduce bleed from other instruments
    const gatedDrums = this.applyNoiseGate(combinedDrums, 0.1);
    
    const drumBuffer = this.audioContext.createBuffer(1, gatedDrums.length, audioBuffer.sampleRate);
    drumBuffer.copyToChannel(new Float32Array(gatedDrums), 0);
    
    console.log('🥁 Drum isolation complete - applied transient detection, multi-band EQ, and noise gate');
    return drumBuffer;
  }

  private async isolateBass(
    audioBuffer: AudioBuffer,
    progressCallback?: (progress: number) => void
  ): Promise<AudioBuffer> {
    console.log('🎸 Isolating bass...');
    
    const channelData = audioBuffer.getChannelData(0);
    
    progressCallback?.(20);
    
    // IMPROVED BASS ISOLATION:
    // 1. Aggressive low-pass filter for fundamental bass frequencies
    const lowBass = await this.applyLowPassFilter(channelData, 120); // Very low fundamentals
    
    progressCallback?.(40);
    
    // 2. Capture bass harmonics (up to 300Hz for bass guitar)
    const bassHarmonics = await this.applyBandPassFilter(channelData, 120, 300);
    
    progressCallback?.(60);
    
    // 3. Combine fundamental and harmonics with proper weighting
    const combinedBass = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      combinedBass[i] = lowBass[i] * 2.0 + bassHarmonics[i] * 0.8; // Emphasize fundamentals
      combinedBass[i] = Math.max(-1, Math.min(1, combinedBass[i]));
    }
    
    progressCallback?.(80);
    
    // 4. Enhance bass punch with subtle compression
    const compressedBass = this.applyCompression(combinedBass, 0.5);
    
    // 5. Add subtle harmonic enhancement for definition
    const enhancedBass = this.enhanceBassDefinition(compressedBass);
    
    const bassBuffer = this.audioContext.createBuffer(1, enhancedBass.length, audioBuffer.sampleRate);
    bassBuffer.copyToChannel(new Float32Array(enhancedBass), 0);
    
    console.log('🎸 Bass isolation complete - applied low-pass, harmonic capture, compression, and definition enhancement');
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
    otherBuffer.copyToChannel(otherTrack, 0);
    
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

  // NEW IMPROVED HELPER METHODS

  private calculateAudioDifference(original: Float32Array, processed: Float32Array): number {
    let sumDifference = 0;
    let sumOriginal = 0;
    const length = Math.min(original.length, processed.length);
    
    for (let i = 0; i < length; i++) {
      sumDifference += Math.abs(original[i] - processed[i]);
      sumOriginal += Math.abs(original[i]);
    }
    
    return sumOriginal > 0 ? sumDifference / sumOriginal : 0;
  }

  private enhancePercussiveAggressive(audioData: Float32Array): Float32Array {
    // More aggressive transient detection for drums
    const enhanced = new Float32Array(audioData.length);
    const windowSize = 128; // Smaller window for better transient detection
    const threshold = 1.8; // Lower threshold for more sensitivity
    
    for (let i = windowSize; i < audioData.length - windowSize; i++) {
      const current = Math.abs(audioData[i]);
      const before = this.getRMS(audioData.slice(i - windowSize, i));
      const after = this.getRMS(audioData.slice(i, i + windowSize));
      
      // Detect sudden amplitude increases (drum hits)
      if (current > before * threshold && current > after * (threshold - 0.3)) {
        enhanced[i] = audioData[i] * 4; // Strong amplification of drum hits
      } else {
        enhanced[i] = audioData[i] * 0.1; // Heavily reduce non-percussive content
      }
    }
    
    // Copy edges
    for (let i = 0; i < windowSize; i++) {
      enhanced[i] = audioData[i] * 0.1;
      enhanced[audioData.length - 1 - i] = audioData[audioData.length - 1 - i] * 0.1;
    }
    
    return enhanced;
  }

  private enhanceVocalFormants(audioData: Float32Array): Float32Array {
    // Enhance typical vocal formant frequencies
    // This is a simplified implementation - in practice would use FFT
    const enhanced = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      // Simple formant enhancement by emphasizing mid-frequencies
      enhanced[i] = audioData[i];
      
      // Add subtle harmonic enhancement for vocal clarity
      if (i > 100 && i < audioData.length - 100) {
        const harmonicBoost = (audioData[i - 50] + audioData[i + 50]) * 0.1;
        enhanced[i] += harmonicBoost;
      }
      
      // Clamp to prevent distortion
      enhanced[i] = Math.max(-1, Math.min(1, enhanced[i]));
    }
    
    return enhanced;
  }

  private applyCompression(audioData: Float32Array, ratio: number): Float32Array {
    // Simple dynamic range compression
    const compressed = new Float32Array(audioData.length);
    const threshold = 0.5; // Compression threshold
    
    for (let i = 0; i < audioData.length; i++) {
      const amplitude = Math.abs(audioData[i]);
      
      if (amplitude > threshold) {
        // Apply compression above threshold
        const excess = amplitude - threshold;
        const compressedExcess = excess * ratio;
        const sign = audioData[i] >= 0 ? 1 : -1;
        compressed[i] = sign * (threshold + compressedExcess);
      } else {
        compressed[i] = audioData[i];
      }
    }
    
    return compressed;
  }

  private applyNoiseGate(audioData: Float32Array, threshold: number): Float32Array {
    // Apply noise gate to reduce low-level noise
    const gated = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      const amplitude = Math.abs(audioData[i]);
      
      if (amplitude < threshold) {
        gated[i] = 0; // Cut signals below threshold
      } else {
        // Smooth transition above threshold
        const ratio = (amplitude - threshold) / (1 - threshold);
        gated[i] = audioData[i] * ratio;
      }
    }
    
    return gated;
  }

  private enhanceBassDefinition(audioData: Float32Array): Float32Array {
    // Add subtle harmonic enhancement for bass definition
    const enhanced = new Float32Array(audioData.length);
    
    for (let i = 0; i < audioData.length; i++) {
      enhanced[i] = audioData[i];
      
      // Add subtle second harmonic for definition (simplified)
      if (i > 50 && i < audioData.length - 50) {
        const harmonicContent = audioData[i - 25] * 0.05; // Very subtle
        enhanced[i] += harmonicContent;
      }
      
      // Clamp to prevent distortion
      enhanced[i] = Math.max(-1, Math.min(1, enhanced[i]));
    }
    
    return enhanced;
  }
}