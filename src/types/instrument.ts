export interface InstrumentConfig {
  name: string;
  strings: string[];
  tuningFreqs: number[];
  fretCount: number;
}

export type InstrumentKey =
  | 'guitar'
  | 'guitar7'
  | 'bass'
  | 'bass5'
  | 'ukulele'
  | 'banjo'
  | 'mandolin'
  | 'violin'
  | 'dobro';

