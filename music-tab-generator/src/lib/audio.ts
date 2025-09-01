import type { InstrumentConfig } from '@/types/instrument';

export interface AnalysisNote {
  timeSec: number;
  frequencyHz: number;
  midi: number;
  note: string;
  amplitude: number;
}

export interface AnalysisResult {
  durationSec: number;
  sampleRate: number;
  notes: AnalysisNote[];
  bpm: number | null;
  key: string | null;
}

export async function decodeArrayBufferToAudioBuffer(
  arrayBuffer: ArrayBuffer,
  audioContext?: AudioContext
): Promise<AudioBuffer> {
  const ctx = audioContext ?? new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  return audioBuffer;
}

export function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = audioBuffer;
  if (numberOfChannels === 1) {
    return audioBuffer.getChannelData(0).slice(0);
  }
  const mixed = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch += 1) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      mixed[i] += data[i] / numberOfChannels;
    }
  }
  return mixed;
}

export function frequencyToMidi(frequencyHz: number): number {
  return Math.round(69 + 12 * Math.log2(frequencyHz / 440));
}

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES_SHARP[midi % 12];
  return `${name}${octave}`;
}

export function rms(frame: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i += 1) {
    const v = frame[i];
    sumSquares += v * v;
  }
  return Math.sqrt(sumSquares / frame.length);
}

export function autocorrelatePitch(
  frame: Float32Array,
  sampleRate: number,
  minFreq = 80,
  maxFreq = 1000
): number | null {
  // Basic ACF pitch detection with parabolic interpolation
  const n = frame.length;
  // Normalize
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += frame[i];
  mean /= n;
  for (let i = 0; i < n; i += 1) frame[i] -= mean;

  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.floor(sampleRate / minFreq);
  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= Math.min(maxLag, n - 1); lag += 1) {
    let corr = 0;
    for (let i = 0; i < n - lag; i += 1) {
      corr += frame[i] * frame[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorr < 1e-3) return null;

  // Parabolic interpolation around bestLag for sub-sample accuracy
  const y0 = bestLag > 1 ? correlationAtLag(frame, bestLag - 1) : bestCorr;
  const y1 = bestCorr;
  const y2 = correlationAtLag(frame, bestLag + 1);
  const denom = 2 * (2 * y1 - y0 - y2);
  const delta = denom !== 0 ? (y0 - y2) / denom : 0;
  const refinedLag = bestLag + delta;
  const frequency = sampleRate / refinedLag;
  if (!isFinite(frequency) || frequency < 20 || frequency > 5000) return null;
  return frequency;
}

function correlationAtLag(frame: Float32Array, lag: number): number {
  let corr = 0;
  for (let i = 0; i < frame.length - lag; i += 1) {
    corr += frame[i] * frame[i + lag];
  }
  return corr;
}

export async function analyzeAudioBuffer(audioBuffer: AudioBuffer): Promise<AnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const mono = mixToMono(audioBuffer);
  const frameSize = 2048;
  const hopSize = 512;
  const notes: AnalysisNote[] = [];
  const durationSec = audioBuffer.duration;

  for (let start = 0; start + frameSize < mono.length; start += hopSize) {
    const frame = mono.subarray(start, start + frameSize);
    const amplitude = rms(frame);
    if (amplitude < 0.01) continue; // skip silence

    const frameCopy = new Float32Array(frame); // autocorrelation mutates by mean removal
    const freq = autocorrelatePitch(frameCopy, sampleRate, 70, 1500);
    if (!freq) continue;
    const midi = frequencyToMidi(freq);
    const note = midiToNoteName(midi);
    const timeSec = start / sampleRate;
    notes.push({ timeSec, frequencyHz: freq, midi, note, amplitude });
  }

  const bpm = estimateTempoFromRms(mono, sampleRate) ?? null;
  const key = estimateKeyFromNotes(notes) ?? null;

  return { durationSec, sampleRate, notes, bpm, key };
}

function estimateTempoFromRms(mono: Float32Array, sampleRate: number): number | null {
  // Very rough tempo estimation from energy envelope autocorrelation
  const window = 1024;
  const hop = 256;
  const energies: number[] = [];
  for (let i = 0; i + window < mono.length; i += hop) {
    const frame = mono.subarray(i, i + window);
    energies.push(rms(frame));
  }
  if (energies.length < 8) return null;

  // Normalize
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  for (let i = 0; i < energies.length; i += 1) energies[i] -= mean;

  // Autocorrelation of energies
  let bestLag = -1;
  let best = 0;
  const minBpm = 60;
  const maxBpm = 180;
  const framesPerSecond = sampleRate / hop;
  const minLag = Math.round(framesPerSecond * 60 / maxBpm);
  const maxLag = Math.round(framesPerSecond * 60 / minBpm);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < energies.length; i += 1) sum += energies[i] * energies[i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  if (bestLag <= 0) return null;
  const secondsPerBeat = bestLag / framesPerSecond;
  const bpm = Math.round(60 / secondsPerBeat);
  if (bpm < 40 || bpm > 240) return null;
  return bpm;
}

function estimateKeyFromNotes(notes: AnalysisNote[]): string | null {
  if (notes.length === 0) return null;
  const counts = new Array(12).fill(0) as number[];
  for (const n of notes) counts[n.midi % 12] += 1;
  const maxIndex = counts.reduce((idx, v, i, arr) => (v > arr[idx] ? i : idx), 0);
  const name = NOTE_NAMES_SHARP[maxIndex];
  return `${name} Major`;
}

export function convertAnalysisToTab(
  analysis: AnalysisResult,
  instrument: InstrumentConfig,
  columns = 64
): string[] {
  const lines = Array.from({ length: instrument.strings.length }, (_, i) => `${instrument.strings[i]}|${'-'.repeat(columns)}`);
  if (analysis.notes.length === 0) return lines;

  const placeAtColumn = (timeSec: number): number => {
    const t = Math.min(Math.max(timeSec / analysis.durationSec, 0), 0.999);
    return Math.floor(t * columns);
  };

  for (const note of analysis.notes) {
    const { stringIndex, fret } = mapFrequencyToStringFret(note.frequencyHz, instrument);
    if (stringIndex < 0 || fret < 0 || fret > instrument.fretCount) continue;
    const col = placeAtColumn(note.timeSec);
    // Insert fret number text at column col
    const prefix = lines[stringIndex].slice(0, 2 + col);
    const current = lines[stringIndex].slice(2 + col);
    const fretText = String(fret);
    lines[stringIndex] = `${prefix}${fretText}${current.slice(fretText.length)}`;
  }

  return lines;
}

function mapFrequencyToStringFret(frequencyHz: number, instrument: InstrumentConfig): { stringIndex: number; fret: number } {
  let bestString = -1;
  let bestFret = -1;
  let bestError = Number.POSITIVE_INFINITY;
  for (let s = 0; s < instrument.tuningFreqs.length; s += 1) {
    const openFreq = instrument.tuningFreqs[s];
    const fretFloat = 12 * Math.log2(frequencyHz / openFreq);
    const fret = Math.round(fretFloat);
    if (fret < 0 || fret > instrument.fretCount) continue;
    const expected = openFreq * Math.pow(2, fret / 12);
    const cents = 1200 * Math.log2(frequencyHz / expected);
    const error = Math.abs(cents);
    if (error < bestError) {
      bestError = error;
      bestString = s;
      bestFret = fret;
    }
  }
  return { stringIndex: bestString, fret: bestFret };
}

