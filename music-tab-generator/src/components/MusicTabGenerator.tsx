"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Play, Pause, Download, Settings, Music, Volume2, FileAudio } from 'lucide-react';
import { INSTRUMENTS } from '@/lib/instruments';
import { decodeArrayBufferToAudioBuffer, computeWaveform, type AnalyzeOptions } from '@/lib/audio';
import { hashBuffer, makeCacheKey } from '@/lib/cache';
import Waveform from './Waveform';
import { toast } from 'sonner';
import { AudioProcessor, type FrameAnalysis } from '@/lib/audioProcessor';
import { TablatureGenerator } from '@/lib/tablatureGenerator';
import { AdvancedSettings, type AdvancedValues } from '@/components/AdvancedSettings';
import { StemMixer } from '@/components/StemMixer';
import { StemBlobMap } from '@/types/stems';
import { untarToMap } from '@/lib/tar';

type InstrumentKey = keyof typeof INSTRUMENTS;

export default function MusicTabGenerator() {
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentKey>('guitar');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [generatedTab, setGeneratedTab] = useState<string[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedTempo, setDetectedTempo] = useState<number | null>(null);
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameAnalysis[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [waveData, setWaveData] = useState<Float32Array | null>(null);
  const [advanced, setAdvanced] = useState<AdvancedValues>({ minHz: 70, maxHz: 1500, sensitivity: 50 });
  const [stems, setStems] = useState<StemBlobMap>({});
  const [sepBusy, setSepBusy] = useState(false);
  const [sepError, setSepError] = useState<string | null>(null);

  const detectFileType = (file: File): boolean => {
    if (file.type && file.type.startsWith('audio/')) return true;
    const fileName = file.name.toLowerCase();
    const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.webm'];
    return audioExtensions.some((ext) => fileName.endsWith(ext));
  };

  const validateAudioFile = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        const view = new Uint8Array(buffer.slice(0, 4));
        const signatures: number[][] = [
          [0xff, 0xfb],
          [0xff, 0xf3],
          [0xff, 0xf2],
          [0x52, 0x49, 0x46, 0x46],
          [0x66, 0x4c, 0x61, 0x43],
          [0x4f, 0x67, 0x67, 0x53],
        ];
        const isValidAudio = signatures.some((sig) => sig.every((b, i) => view[i] === b));
        resolve(isValidAudio || detectFileType(file));
      };
      reader.readAsArrayBuffer(file.slice(0, 4));
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    console.log('File selected:', file.name, file.type, file.size);

    const validTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/flac',
      'audio/x-flac',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/ogg',
      'audio/webm',
    ];
    const validExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
    let isValidType = file.type ? validTypes.includes(file.type.toLowerCase()) : false;
    if (!isValidType) {
      const ext = file.name.toLowerCase().substring(file.name.toLowerCase().lastIndexOf('.'));
      isValidType = validExtensions.includes(ext);
    }
    if (!isValidType) {
      const ok = await validateAudioFile(file);
      if (!ok) {
        toast.error(`Invalid file type: ${file.type || 'unknown'}. Please select an audio file (MP3, WAV, FLAC, M4A, AAC, OGG)`);
        return;
      }
    }
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 50MB.`);
      return;
    }
    setUploadedFile(file);
    toast.success(`File accepted: ${file.name}`);
  };

  const selectedInstrumentConfig = useMemo(() => INSTRUMENTS[selectedInstrument], [selectedInstrument]);

  const mapInstrument = (key: InstrumentKey): string => {
    // Map to generator's internal keys when needed
    if (key === 'guitar7') return 'guitar';
    if (key === 'bass5') return 'bass';
    return key;
  };

  const loadAudioFromFile = async (file: File): Promise<ArrayBuffer> => {
    return await file.arrayBuffer();
  };

  // YouTube functionality removed

  const handleProcess = async () => {
    if (!uploadedFile) return;
    setErrorMsg(null);
    setIsProcessing(true);
    setShowResults(false);
    setAnalysis(null);
    setGeneratedTab(null);

    try {
      let arrayBuffer: ArrayBuffer | null = await loadAudioFromFile(uploadedFile);

      // no server fallback; require audio bytes

      if (!arrayBuffer) throw new Error('Unable to load audio');
      // Cache disabled by design

      const audioBuffer = await decodeArrayBufferToAudioBuffer(arrayBuffer);
      const mono = audioBuffer.getChannelData(0).slice(0);
      setWaveData(computeWaveform(mono, 600));

      const processor = new AudioProcessor();
      const analyses = processor.analyzeAudioBuffer(audioBuffer);
      setFrames(analyses);

      const generator = new TablatureGenerator();
      const tablature = generator.generateTablature(analyses, mapInstrument(selectedInstrument));
      setGeneratedTab(tablature.lines);
      setDetectedTempo(tablature.tempo || processor.detectTempo(analyses) || null);
      setDetectedKey(tablature.key || null);
      setShowResults(true);
      toast.success('Analysis complete');

      // Cache disabled

      if (audioRef.current) {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const blob = new Blob([arrayBuffer], { type: uploadedFile?.type || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        audioRef.current.src = url;
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Processing failed');
      toast.error(err?.message || 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const buildCacheKey = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const fileHash = await hashBuffer(arrayBuffer);
    return makeCacheKey([`file:${uploadedFile?.name || 'unknown'}`, fileHash, `inst:${selectedInstrument}`]);
  };

  useEffect(() => {
    const node = audioRef.current;
    if (!node) return;
    const onTime = () => {
      if (!node.duration || isNaN(node.duration)) return;
      setPlaybackPosition(Math.min(100, (node.currentTime / node.duration) * 100));
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    node.addEventListener('timeupdate', onTime);
    node.addEventListener('play', onPlay);
    node.addEventListener('pause', onPause);
    return () => {
      node.removeEventListener('timeupdate', onTime);
      node.removeEventListener('play', onPlay);
      node.removeEventListener('pause', onPause);
    };
  }, []);

  const togglePlayback = () => {
    const node = audioRef.current;
    if (!node) return;
    if (node.paused) node.play();
    else node.pause();
  };

  const exportTablature = () => {
    if (!generatedTab) return;
    const content = generatedTab.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${INSTRUMENTS[selectedInstrument].name.toLowerCase().replace(/\s+/g, '-')}-tab.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPdf = async (tab: string[]) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt' });
    doc.setFont('Courier', 'normal');
    let y = 40;
    tab.forEach((line) => {
      doc.text(line, 40, y);
      y += 16;
    });
    doc.save(`${INSTRUMENTS[selectedInstrument].name.toLowerCase().replace(/\s+/g, '-')}-tab.pdf`);
  };

  const exportMidi = async () => {
    if (!frames || frames.length === 0) return;
    const { Midi } = await import('@tonejs/midi');
    const midi = new Midi();
    const track = midi.addTrack();
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (!f.frequency || f.frequency <= 0) continue;
      const midiNum = Math.round(69 + 12 * Math.log2(f.frequency / 440));
      const nextTime = i + 1 < frames.length ? frames[i + 1].timestamp : f.timestamp + 0.125;
      const duration = Math.max(0.05, nextTime - f.timestamp);
      track.addNote({ midi: midiNum, time: f.timestamp, duration, velocity: Math.max(0.1, Math.min(1, f.amplitude * 2)) });
    }
    const bytes = midi.toArray();
    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    const blob = new Blob([buf], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${INSTRUMENTS[selectedInstrument].name.toLowerCase().replace(/\s+/g, '-')}.mid`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onGenerateStems = async (file: File) => {
    setSepBusy(true); 
    setSepError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "htdemucs");           // configurable later
      formData.append("stems", "vocals,drums,bass,other");

      const res = await fetch("/api/stems/separate", { 
        method: "POST", 
        body: formData 
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `Separation failed: ${res.status}`);
      }
      
      const arrayBuffer = await res.arrayBuffer();
      const files = await untarToMap(arrayBuffer);
      const stemMap: StemBlobMap = {};
      
      files.forEach((blob, name) => {
        const key = name.replace(/\.wav$/,"") as keyof StemBlobMap;
        if (key in {vocals: 1, drums: 1, bass: 1, guitar: 1, piano: 1, other: 1}) {
          stemMap[key] = blob;
        }
      });
      
      setStems(stemMap);
      toast.success("Stems generated successfully!");
    } catch (error: any) {
      setSepError(error?.message || "Failed to generate stems");
      toast.error(error?.message || "Failed to generate stems");
    } finally {
      setSepBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Music className="h-12 w-12 text-purple-400 mr-4" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">TabCraft Pro</h1>
          </div>
          <p className="text-xl text-gray-300">Transform any song into perfect tablature for your instrument</p>
        </div>

        <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-center flex items-center justify-center">
            <Upload className="h-6 w-6 mr-2 text-purple-400" />
            Upload Your Audio File
          </h2>

          <div className="mb-6">
            <div className="border-2 border-dashed border-purple-400 rounded-lg p-12 text-center cursor-pointer hover:border-purple-300 transition-colors touch-manipulation" onClick={() => fileInputRef.current?.click()} style={{ minHeight: '200px', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' as any }}>
              <FileAudio className="h-16 w-16 text-purple-400 mx-auto mb-6" />
              <p className="text-gray-300 text-lg mb-2">{uploadedFile ? uploadedFile.name : 'Tap to select audio file'}</p>
              <p className="text-sm text-gray-400">MP3, WAV, FLAC, M4A, AAC, OGG</p>
              <p className="text-xs text-gray-500 mt-2">Maximum file size: 50MB</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg"
                capture={false as any}
                multiple={false}
                onChange={handleFileUpload}
                // @ts-ignore iOS specific attributes
                webkitdirectory={false}
                // @ts-ignore
                directory={false}
              />
            </div>
          </div>

          <AdvancedSettings value={advanced} onChange={setAdvanced} />

          <div className="mt-6 rounded-lg border border-purple-400/30 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-purple-400">Stem Separation</h3>
              <button
                onClick={() => uploadedFile && onGenerateStems(uploadedFile)}
                disabled={!uploadedFile || sepBusy}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                {sepBusy ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Separating…
                  </>
                ) : (
                  "Generate Stems"
                )}
              </button>
            </div>
            {sepError && <p className="text-sm text-red-400 mb-2">{sepError}</p>}
            <p className="text-xs text-gray-400 mb-3">
              Run locally with Demucs. CPU works but is slow; GPU recommended.
            </p>

            {Object.values(stems).some(Boolean) && (
              <div className="mt-4">
                <StemMixer stems={stems} />
              </div>
            )}
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-4">Select Instrument</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(INSTRUMENTS).map(([key, instrument]) => (
                <button
                  key={key}
                  onClick={() => setSelectedInstrument(key as InstrumentKey)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedInstrument === (key as InstrumentKey)
                      ? 'border-purple-400 bg-purple-400/20 text-white'
                      : 'border-gray-600 bg-white/5 text-gray-300 hover:border-purple-400/50'
                  }`}
                >
                  <div className="font-medium text-sm">{instrument.name}</div>
                  <div className="text-xs text-gray-400">{instrument.strings.join('-')}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleProcess}
            disabled={!uploadedFile || isProcessing}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Processing Audio...
              </>
            ) : (
              <>
                <Settings className="h-5 w-5 mr-2" />
                Generate Tablature
              </>
            )}
          </button>
        </div>

        {showResults && (
          <div className="max-w-6xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <h2 className="text-2xl font-semibold mb-4 md:mb-0">Generated Tablature - {INSTRUMENTS[selectedInstrument].name}</h2>
              <div className="flex flex-wrap gap-3">
                <button onClick={togglePlayback} className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
                  {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button onClick={exportTablature} className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                  <Download className="h-4 w-4 mr-2" />
                  Export TXT
                </button>
                <button disabled={!generatedTab} onClick={() => generatedTab && exportPdf(generatedTab)} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </button>
                <button disabled={!frames} onClick={() => exportMidi()} className="flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50">
                  <Download className="h-4 w-4 mr-2" />
                  Export MIDI
                </button>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Volume2 className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-gray-300">Playback Progress</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-300" style={{ width: `${playbackPosition}%` }}></div>
              </div>
              <audio ref={audioRef} className="hidden" />
            </div>

            <div className="bg-black/30 rounded-lg p-6 overflow-x-auto">
              <div className="font-mono text-sm leading-relaxed whitespace-pre">
                {(generatedTab ?? []).map((line, index) => (
                  <div key={index} className="mb-1 text-green-400">{line}</div>
                ))}
              </div>
            </div>

            {waveData && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2 text-purple-400">Waveform</h3>
                <Waveform data={waveData} />
              </div>
            )}

            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-purple-400">Detected Tempo</h3>
                <p className="text-2xl">{detectedTempo ?? '—'} BPM</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-purple-400">Key Signature</h3>
                <p className="text-2xl">{detectedKey ?? '—'}</p>
              </div>
            </div>
            {'chords' in (analysis as any || {}) && Array.isArray((analysis as any).chords) && (
              <div className="mt-6 bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-purple-400">Chord Hints</h3>
                <div className="flex flex-wrap gap-2 text-sm text-gray-200">
                  {((analysis as any).chords as Array<{ timeSec: number; chord: string }>).slice(0, 24).map((c, i) => (
                    <span key={i} className="px-2 py-1 rounded bg-purple-500/20 border border-purple-400/40">
                      {c.chord} @ {c.timeSec.toFixed(1)}s
                    </span>
                  ))}
                </div>
              </div>
            )}
            {errorMsg && <div className="mt-6 text-sm text-red-300">{errorMsg}</div>}
          </div>
        )}

        {!showResults && (
          <div className="max-w-4xl mx-auto mt-12">
            <h2 className="text-2xl font-semibold text-center mb-8">Features</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-white/5 rounded-lg">
                <Music className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Multi-Instrument Support</h3>
                <p className="text-gray-300 text-sm">Guitar, Bass, Ukulele, Banjo, Mandolin, and more</p>
              </div>
              <div className="text-center p-6 bg-white/5 rounded-lg">
                <Settings className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">AI-Powered Transcription</h3>
                <p className="text-gray-300 text-sm">Advanced algorithms for accurate note detection</p>
              </div>
              <div className="text-center p-6 bg-white/5 rounded-lg">
                <Download className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Export Options</h3>
                <p className="text-gray-300 text-sm">Download as text, PDF, or import into popular software</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

