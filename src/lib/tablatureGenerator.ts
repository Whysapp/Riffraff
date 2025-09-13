import type { FrameAnalysis } from './audioProcessor';

export class TablatureGenerator {
  private instrumentConfigs: Record<string, { strings: string[]; tuningFreqs: number[]; fretCount: number }> = {
    guitar: {
      strings: ['E', 'A', 'D', 'G', 'B', 'E'],
      tuningFreqs: [82.41, 110.0, 146.83, 196.0, 246.94, 329.63],
      fretCount: 24,
    },
    bass: {
      strings: ['E', 'A', 'D', 'G'],
      tuningFreqs: [41.2, 55.0, 73.42, 98.0],
      fretCount: 24,
    },
    ukulele: {
      strings: ['G', 'C', 'E', 'A'],
      tuningFreqs: [196.0, 261.63, 329.63, 440.0],
      fretCount: 15,
    },
  };

  generateTablature(analysisResults: FrameAnalysis[], instrument: string) {
    const config = this.instrumentConfigs[instrument];
    if (!config) throw new Error(`Instrument ${instrument} not supported`);
    const tablatureLines: string[][] = config.strings.map(() => []);

    const segments = this.groupByTimeSegments(analysisResults);
    segments.forEach((segment) => {
      const dominantFreq = this.getDominantFrequency(segment);
      const fretPosition = this.frequencyToFret(dominantFreq, config);
      this.addToTablature(tablatureLines, fretPosition, config.strings.length);
    });

    return {
      lines: this.formatTablature(tablatureLines, config.strings),
      tempo: this.calculateTempo(analysisResults),
      key: this.detectKey(analysisResults),
      instrument,
    };
  }

  private groupByTimeSegments(results: FrameAnalysis[]): FrameAnalysis[][] {
    const segmentDuration = 0.125;
    const segments: FrameAnalysis[][] = [];
    let current: FrameAnalysis[] = [];
    let segmentStart = results.length > 0 ? results[0].timestamp : 0;
    for (const r of results) {
      if (r.timestamp - segmentStart > segmentDuration) {
        if (current.length) segments.push(current);
        current = [r];
        segmentStart = r.timestamp;
      } else {
        current.push(r);
      }
    }
    if (current.length) segments.push(current);
    return segments;
  }

  private getDominantFrequency(segment: FrameAnalysis[]): number {
    if (segment.length === 0) return 0;
    let best = segment[0];
    for (const r of segment) if (r.amplitude > best.amplitude) best = r;
    return best.frequency;
  }

  private frequencyToFret(
    frequency: number,
    config: { tuningFreqs: number[]; fretCount: number }
  ): { string: number; fret: number } | null {
    if (frequency < 40 || !isFinite(frequency)) return null;
    let best: { string: number; fret: number } | null = null;
    let smallestFret = Infinity;
    config.tuningFreqs.forEach((openFreq, stringIndex) => {
      const fret = Math.round(12 * Math.log2(frequency / openFreq));
      if (fret >= 0 && fret <= config.fretCount && fret < smallestFret) {
        smallestFret = fret;
        best = { string: stringIndex, fret };
      }
    });
    return best;
  }

  private addToTablature(tablatureLines: string[][], fretPos: { string: number; fret: number } | null, stringCount: number) {
    for (let i = 0; i < stringCount; i++) {
      if (fretPos && i === fretPos.string) {
        tablatureLines[i].push(String(fretPos.fret));
      } else {
        tablatureLines[i].push('-');
      }
    }
  }

  private formatTablature(lines: string[][], stringNames: string[]): string[] {
    return lines.map((line, index) => {
      const name = stringNames[stringNames.length - 1 - index];
      const body = line.join('--');
      return `${name}|--${body}--|`;
    });
  }

  private calculateTempo(results: FrameAnalysis[]): number {
    const peaks = results.filter((r) => r.amplitude > 0.1);
    if (peaks.length < 4) return 0;
    const intervals: number[] = [];
    for (let i = 1; i < Math.min(peaks.length, 20); i++) intervals.push(peaks[i].timestamp - peaks[i - 1].timestamp);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60 / (avg * 4));
    return isFinite(bpm) && bpm > 0 && bpm < 300 ? bpm : 0;
  }

  private detectKey(results: FrameAnalysis[]): string {
    const A4 = 440;
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const freqs = results.map((r) => r.frequency).filter((f) => f > 0);
    const notes = freqs.map((f) => {
      const semis = Math.round(12 * Math.log2(f / A4)) + 57;
      return names[((semis % 12) + 12) % 12];
    });
    const counts: Record<string, number> = {};
    for (const n of notes) counts[n] = (counts[n] ?? 0) + 1;
    const top = Object.keys(counts).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0] ?? 'C';
    return `${top} Major`;
  }
}

