/**
 * Audio compression utilities to reduce file sizes before API calls
 */

export interface CompressionOptions {
  maxSizeBytes: number;
  quality: number; // 0.1 to 1.0
  format: 'mp3' | 'wav';
}

/**
 * Compress an audio file if it exceeds the maximum size
 */
export async function compressAudioFile(
  file: File,
  options: CompressionOptions
): Promise<File> {
  // If file is already small enough, return as-is
  if (file.size <= options.maxSizeBytes) {
    return file;
  }

  try {
    // Create audio context for processing
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Read the file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Calculate compression ratio needed
    const compressionRatio = options.maxSizeBytes / file.size;
    const targetSampleRate = Math.floor(audioBuffer.sampleRate * Math.sqrt(compressionRatio));
    
    // Create offline context with reduced sample rate
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.floor(audioBuffer.length * compressionRatio),
      Math.max(8000, Math.min(targetSampleRate, 44100)) // Keep between 8kHz and 44.1kHz
    );
    
    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    
    // Render the compressed audio
    const compressedBuffer = await offlineContext.startRendering();
    
    // Convert back to file
    const compressedFile = await audioBufferToFile(compressedBuffer, file.name, options.format);
    
    // Close audio contexts
    audioContext.close();
    
    return compressedFile;
  } catch (error) {
    console.warn('Audio compression failed, using original file:', error);
    return file;
  }
}

/**
 * Convert AudioBuffer back to File
 */
async function audioBufferToFile(
  audioBuffer: AudioBuffer,
  originalName: string,
  format: 'mp3' | 'wav'
): Promise<File> {
  // For now, we'll create a WAV file (MP3 encoding requires additional libraries)
  const wav = audioBufferToWav(audioBuffer);
  const blob = new Blob([wav], { type: 'audio/wav' });
  
  // Create new filename with compression indicator
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  const newName = `${nameWithoutExt}_compressed.wav`;
  
  return new File([blob], newName, { type: 'audio/wav' });
}

/**
 * Convert AudioBuffer to WAV format
 */
function audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length * numberOfChannels * 2;
  
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const int16 = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }
  
  return buffer;
}

/**
 * Get recommended compression options based on file size and target
 */
export function getCompressionOptions(
  fileSize: number,
  target: 'tablature' | 'stems'
): CompressionOptions {
  const maxSizes = {
    tablature: 25 * 1024 * 1024, // 25MB
    stems: 50 * 1024 * 1024, // 50MB
  };
  
  const maxSize = maxSizes[target];
  const compressionRatio = maxSize / fileSize;
  
  return {
    maxSizeBytes: maxSize,
    quality: Math.max(0.3, Math.min(1.0, compressionRatio)), // Between 30% and 100%
    format: 'wav'
  };
}