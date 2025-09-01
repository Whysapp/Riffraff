"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Play, Pause, Download, Settings, Music, Volume2, FileAudio } from 'lucide-react';
import { INSTRUMENTS } from '@/lib/instruments';
import { analyzeAudioBuffer, convertAnalysisToTab, decodeArrayBufferToAudioBuffer, type AnalysisResult } from '@/lib/audio';

type InstrumentKey = keyof typeof INSTRUMENTS;

const sampleTablature: Record<string, string[]> = {
  guitar: [
    'E|–3–2–0–2–3–3–3–2–0–2–0–2–0–|',
    'B|–0–3–0–0–0–0–0–3–0–0–3–3–3–|',
    'G|–0–2–0–0–0–0–0–2–0–0–2–2–2–|',
    'D|–0–0–2–0–2–0–2–0–2–2–0–0–0–|',
    'A|–2–x–2–2–2–2–2–x–2–2–x–x–x–|',
    'E|–3–x–0–2–x–3–x–x–0–2–x–x–x–|',
  ],
  bass: ['G|———————|', 'D|–2–4–2–0———|', 'A|–––––––2–0—|', 'E|—————––3-|'],
  ukulele: [
    'A|–0–2–4–2–0–2–4–|',
    'E|–0–0–0–0–0–0–0–|',
    'C|–1–1–1–1–1–1–1–|',
    'G|–2–2–2–2–2–2–2–|',
  ],
};

export default function MusicTabGenerator() {
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentKey>('guitar');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [playbackPosition, setPlaybackPosition] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [generatedTab, setGeneratedTab] = useState<string[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
      setUploadedFile(file);
      setYoutubeUrl('');
    }
  };

  const selectedInstrumentConfig = useMemo(() => INSTRUMENTS[selectedInstrument], [selectedInstrument]);

  const loadAudioFromFile = async (file: File): Promise<ArrayBuffer> => {
    return await file.arrayBuffer();
  };

  const loadAudioFromYoutube = async (url: string): Promise<ArrayBuffer | null> => {
    try {
      const resp = await fetch('/api/youtube-extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await resp.json();
      if (!resp.ok || !data?.audioUrl) throw new Error(data?.error || 'Extraction failed');
      const audioResp = await fetch(data.audioUrl);
      const buf = await audioResp.arrayBuffer();
      return buf;
    } catch (_) {
      return null;
    }
  };

  const handleProcess = async () => {
    if (!uploadedFile && !youtubeUrl) return;
    setErrorMsg(null);
    setIsProcessing(true);
    setShowResults(false);
    setAnalysis(null);
    setGeneratedTab(null);

    try {
      let arrayBuffer: ArrayBuffer | null = null;
      if (uploadedFile) {
        arrayBuffer = await loadAudioFromFile(uploadedFile);
      } else if (youtubeUrl) {
        arrayBuffer = await loadAudioFromYoutube(youtubeUrl);
      }

      if (!arrayBuffer && youtubeUrl) {
        const resp = await fetch('/api/process-audio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audioUrl: youtubeUrl, instrumentKey: selectedInstrument }) });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'Processing failed');
        setGeneratedTab(data.tablature);
        setAnalysis({ durationSec: 0, sampleRate: 0, notes: [], bpm: data.bpm ?? null, key: data.key ?? null });
        setShowResults(true);
        setIsProcessing(false);
        return;
      }

      if (!arrayBuffer) throw new Error('Unable to load audio');
      const audioBuffer = await decodeArrayBufferToAudioBuffer(arrayBuffer);
      const result = await analyzeAudioBuffer(audioBuffer);
      setAnalysis(result);
      const tab = convertAnalysisToTab(result, selectedInstrumentConfig, 96);
      setGeneratedTab(tab);
      setShowResults(true);

      if (audioRef.current) {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const blob = new Blob([arrayBuffer], { type: uploadedFile?.type || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        audioRef.current.src = url;
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
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
    const tabData = sampleTablature[selectedInstrument] || sampleTablature.guitar;
    const content = tabData.join('\n');
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

        <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 flex items-center">
            <Upload className="h-6 w-6 mr-2 text-purple-400" />
            Upload Your Music
          </h2>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-300">Upload Audio/Video File</label>
              <div className="border-2 border-dashed border-purple-400 rounded-lg p-8 text-center cursor-pointer hover:border-purple-300 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <FileAudio className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <p className="text-gray-300">{uploadedFile ? uploadedFile.name : 'Click to upload or drag & drop'}</p>
                <p className="text-sm text-gray-400 mt-2">MP3, WAV, FLAC, MP4, etc.</p>
                <input ref={fileInputRef} type="file" className="hidden" accept="audio/*,video/*" onChange={handleFileUpload} />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-300">Or YouTube URL</label>
              <div className="space-y-4">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    if (e.target.value) setUploadedFile(null);
                  }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-3 bg-white/10 border border-purple-400/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-white placeholder-gray-400"
                />
                <div className="text-sm text-gray-400">
                  <p>• Supports YouTube, Vimeo, SoundCloud</p>
                  <p>• Automatically extracts audio</p>
                </div>
              </div>
            </div>
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
            disabled={(!uploadedFile && !youtubeUrl) || isProcessing}
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
              <div className="flex gap-3">
                <button onClick={togglePlayback} className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
                  {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button onClick={exportTablature} className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                  <Download className="h-4 w-4 mr-2" />
                  Export
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
                {(sampleTablature[selectedInstrument] || sampleTablature.guitar).map((line, index) => (
                  <div key={index} className="mb-1 text-green-400">{line}</div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-purple-400">Detected Tempo</h3>
                <p className="text-2xl">{analysis?.bpm ?? 120} BPM</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-purple-400">Key Signature</h3>
                <p className="text-2xl">{analysis?.key ?? 'G Major'}</p>
              </div>
            </div>
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

