/// <reference lib="webworker" />
import { AnalyzeOptions, autocorrelatePitch, frequencyToMidi, midiToNoteName, rms } from '@/lib/audio';

export type WorkerIn = {
  samples: Float32Array;
  sampleRate: number;
  options?: AnalyzeOptions;
  durationSec: number;
};

export type WorkerOut = import('@/lib/audio').AnalysisResult;

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
  }

  const result: WorkerOut = {
    durationSec,
    sampleRate,
    notes,
    bpm: null,
    key: null,
  };
  // @ts-ignore
  self.postMessage(result);
};

