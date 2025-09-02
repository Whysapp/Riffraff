/// <reference lib="webworker" />
import { AnalyzeOptions, autocorrelatePitch, frequencyToMidi, midiToNoteName, rms, detectChords } from '@/lib/audio';

export type WorkerIn = {
  samples: Float32Array;
  sampleRate: number;
  options?: AnalyzeOptions;
  durationSec: number;
};

export type WorkerOut = import('@/lib/audio').AnalysisResult;

function estimateTempoFromRms(samples: Float32Array, sampleRate: number): number | null {
  const window = 1024;
  const hop = 256;
  const energies: number[] = [];
  for (let i = 0; i + window < samples.length; i += hop) {
    const frame = samples.subarray(i, i + window);
    energies.push(rms(frame));
  }
  if (energies.length < 8) return null;
  let mean = 0;
  for (let i = 0; i < energies.length; i += 1) mean += energies[i];
  mean /= energies.length;
  for (let i = 0; i < energies.length; i += 1) energies[i] -= mean;
  let bestLag = -1;
  let best = 0;
  const minBpm = 60;
  const maxBpm = 180;
  const framesPerSecond = sampleRate / hop;
  const minLag = Math.round((framesPerSecond * 60) / maxBpm);
  const maxLag = Math.round((framesPerSecond * 60) / minBpm);
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

function estimateKeyFromNotes(notes: WorkerOut['notes']): string | null {
  if (notes.length === 0) return null;
  const counts = new Array(12).fill(0) as number[];
  for (const n of notes) counts[n.midi % 12] += 1;
  const maxIndex = counts.reduce((idx, v, i, arr) => (v > arr[idx] ? i : idx), 0);
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[maxIndex]} Major`;
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { samples, sampleRate, options, durationSec } = e.data;
  const frameSize = options?.frameSize ?? 2048;
  const hopSize = options?.hopSize ?? 512;
  const threshold = options?.amplitudeThreshold ?? 0.01;
  const notes: WorkerOut['notes'] = [];

  for (let start = 0; start + frameSize < samples.length; start += hopSize) {
    const frame = samples.subarray(start, start + frameSize);
    const amp = rms(frame);
    if (amp < threshold) continue;
    const freq = autocorrelatePitch(new Float32Array(frame), sampleRate, options?.minFreq ?? 70, options?.maxFreq ?? 1500);
    if (!freq) continue;
    const midi = frequencyToMidi(freq);
    const note = midiToNoteName(midi);
    const timeSec = start / sampleRate;
    notes.push({ timeSec, frequencyHz: freq, midi, note, amplitude: amp });

    // progress event every ~1s
    if (start % (sampleRate * 1) === 0) {
      // @ts-ignore
      self.postMessage({ progress: Math.min(1, start / samples.length) });
    }
  }

  const bpm = estimateTempoFromRms(samples, sampleRate);
  const key = estimateKeyFromNotes(notes);
  const result: WorkerOut = { durationSec, sampleRate, notes, bpm, key };
  // Include chord hints in a non-breaking field
  // @ts-ignore
  result.chords = detectChords(notes);
  // @ts-ignore
  self.postMessage(result);
};

