import type { InstrumentConfig } from '@/types/instrument';

export const INSTRUMENTS: Record<string, InstrumentConfig> = {
  guitar: {
    name: 'Guitar (6-string)',
    strings: ['E', 'A', 'D', 'G', 'B', 'E'],
    tuningFreqs: [82.41, 110.0, 146.83, 196.0, 246.94, 329.63],
    fretCount: 24,
  },
  guitar7: {
    name: '7-String Guitar',
    strings: ['B', 'E', 'A', 'D', 'G', 'B', 'E'],
    tuningFreqs: [61.74, 82.41, 110.0, 146.83, 196.0, 246.94, 329.63],
    fretCount: 24,
  },
  bass: {
    name: 'Bass Guitar (4-string)',
    strings: ['E', 'A', 'D', 'G'],
    tuningFreqs: [41.2, 55.0, 73.42, 98.0],
    fretCount: 24,
  },
  bass5: {
    name: '5-String Bass',
    strings: ['B', 'E', 'A', 'D', 'G'],
    tuningFreqs: [30.87, 41.2, 55.0, 73.42, 98.0],
    fretCount: 24,
  },
  ukulele: {
    name: 'Ukulele',
    strings: ['G', 'C', 'E', 'A'],
    tuningFreqs: [392.0, 261.63, 329.63, 440.0],
    fretCount: 18,
  },
  banjo: {
    name: 'Banjo (5-string)',
    strings: ['G', 'D', 'G', 'B', 'D'],
    tuningFreqs: [392.0, 293.66, 196.0, 246.94, 293.66],
    fretCount: 22,
  },
  mandolin: {
    name: 'Mandolin',
    strings: ['G', 'D', 'A', 'E'],
    tuningFreqs: [196.0, 293.66, 440.0, 659.25],
    fretCount: 20,
  },
  violin: {
    name: 'Violin',
    strings: ['G', 'D', 'A', 'E'],
    tuningFreqs: [196.0, 293.66, 440.0, 659.25],
    fretCount: 24,
  },
  dobro: {
    name: 'Dobro/Resonator',
    strings: ['G', 'B', 'D', 'G', 'B', 'D'],
    tuningFreqs: [196.0, 246.94, 293.66, 392.0, 493.88, 587.33],
    fretCount: 24,
  },
};

