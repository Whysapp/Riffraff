"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Play, Pause, Download, Settings, Music, Volume2, FileAudio } from 'lucide-react';
import { INSTRUMENTS } from '@/lib/instruments';
import { decodeArrayBufferToAudioBuffer, computeWaveform, type AnalyzeOptions } from '@/lib/audio';
import { clearAllCache, getCache, hashBuffer, makeCacheKey, setCache } from '@/lib/cache';
import Waveform from './Waveform';
import { toast } from 'sonner';
import { AudioProcessor, type FrameAnalysis } from '@/lib/audioProcessor';
import { TablatureGenerator } from '@/lib/tablatureGenerator';

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
  const [options, setOptions] = useState<AnalyzeOptions>({ minFreq: 70, maxFreq: 1500, amplitudeThreshold: 0.01 });
  const [useCache, setUseCache] = useState<boolean>(true);
  const [stems, setStems] = useState<{drums: string, bass: string, other: string, vocals: string} | null>(null);
  const [isSeparatingStems, setIsSeparatingStems] = useState<boolean>(false);
  const [stemJobStatus, setStemJobStatus] = useState<string>('');
  const [stemJobId, setStemJobId] = useState<string | null>(null);

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
    // Check file size limits based on feature
    const maxSizeForTabs = 25 * 1024 * 1024; // 25MB for tablature
    const maxSizeForStems = 50 * 1024 * 1024; // 50MB for stems
    const maxSize = Math.max(maxSizeForTabs, maxSizeForStems);
    
    if (file.size > maxSize) {
      toast.error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is ${maxSize / 1024 / 1024}MB.`);
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

      if (!arrayBuffer) throw new Error('Unable to load audio');
      const cacheKey = await buildCacheKey(arrayBuffer);
      if (useCache) {
        const cached = getCache(cacheKey);
        if (cached) {
          setAnalysis(cached.analysis);
          setGeneratedTab(cached.tab);
          setShowResults(true);
          toast.success('Loaded from cache');
          setIsProcessing(false);
          return;
        }
      }

      // Generate waveform for display
      const audioBuffer = await decodeArrayBufferToAudioBuffer(arrayBuffer);
      const mono = audioBuffer.getChannelData(0).slice(0);
      setWaveData(computeWaveform(mono, 600));

      // Use HuggingFace Guitar Tabs AI for tablature generation
      toast.info('Generating tablature with AI...');
      
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('instrumentKey', selectedInstrument);

      const response = await fetch('/api/process-audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error(`File too large for tablature generation. Please use a smaller audio file (under 25MB) or try compressing it.`);
        }
        throw new Error(`Tablature generation failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.ok) {
        throw new Error(result.error || 'Tablature generation failed');
      }

      setGeneratedTab(result.tablature);
      setDetectedTempo(result.bpm || null);
      setDetectedKey(result.key || null);
      setShowResults(true);
      
      // Show success message with source info
      const sourceMsg = result.source === 'huggingface' ? 'Generated with HuggingFace AI' :
                       result.source === 'proxy' ? 'Generated with HuggingFace AI (via proxy)' :
                       'Generated with fallback method';
      toast.success(sourceMsg);

      // Persist to cache
      setCache(cacheKey, { 
        analysis: { tempo: result.bpm, key: result.key }, 
        tab: result.tablature 
      });

      // Set up audio playback
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

  const handleStemSeparation = async () => {
    if (!uploadedFile) return;
    setIsSeparatingStems(true);
    setStems(null);
    setStemJobStatus('Starting...');
    setStemJobId(null);

    try {
      toast.info('Starting stem separation with AI...');
      
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/stems/separate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error(`File too large for stem separation. Please use a smaller audio file (under 50MB) or try compressing it.`);
        }
        throw new Error(`Stem separation failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Stem separation failed');
      }

      // Check if we got immediate results or a job ID
      if (result.stems) {
        // Immediate results
        setStems(result.stems);
        setStemJobStatus('Completed');
        
        const sourceMsg = result.source === 'huggingface' ? 'Stems separated with HuggingFace AI' :
                         result.source === 'proxy' ? 'Stems separated with HuggingFace AI (via proxy)' :
                         'Stems separated with fallback method';
        toast.success(sourceMsg);
        
      } else if (result.jobId) {
        // Async job started - poll for results
        setStemJobId(result.jobId);
        setStemJobStatus('Processing in queue...');
        toast.info('Job started! Processing may take 2-5 minutes...');
        
        // Start polling for results
        pollStemJobStatus(result.jobId, result.sessionHash);
      } else {
        throw new Error('Unexpected response format');
      }

    } catch (err: any) {
      toast.error(err?.message || 'Stem separation failed');
      setIsSeparatingStems(false);
      setStemJobStatus('');
    }
  };

  const pollStemJobStatus = async (jobId: string, sessionHash: string) => {
    const maxAttempts = 60; // 5 minutes at 5-second intervals
    let attempts = 0;
    
    const poll = async () => {
      try {
        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts} for job ${jobId}`);
        
        const statusResponse = await fetch(`/api/stems/status?jobId=${jobId}&sessionHash=${sessionHash}`);
        
        if (statusResponse.ok) {
          const statusResult = await statusResponse.json();
          console.log('Status result:', statusResult);
          
          if (statusResult.success === true && statusResult.stems) {
            // Job completed successfully
            setStems(statusResult.stems);
            setStemJobStatus('Completed');
            setIsSeparatingStems(false);
            toast.success('Stems separated successfully with HuggingFace AI!');
            return;
            
          } else if (statusResult.success === false) {
            // Job failed
            setStemJobStatus('Failed');
            setIsSeparatingStems(false);
            toast.error(statusResult.error || 'Stem separation failed');
            return;
            
          } else {
            // Still processing
            const status = statusResult.status || 'processing';
            const message = statusResult.message || 'Processing...';
            setStemJobStatus(message);
            
            if (statusResult.queuePosition !== undefined) {
              toast.info(`Queue position: ${statusResult.queuePosition}, estimated: ${statusResult.estimatedTime}s`);
            }
          }
        } else {
          console.warn(`Status check failed: ${statusResponse.status}`);
        }
        
        // Continue polling if not completed and within limits
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          // Timeout
          setStemJobStatus('Timeout - please try again');
          setIsSeparatingStems(false);
          toast.error('Processing timeout. Please try again with a smaller file.');
        }
        
      } catch (pollError) {
        console.error('Polling error:', pollError);
        
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Retry on error
        } else {
          setStemJobStatus('Error checking status');
          setIsSeparatingStems(false);
          toast.error('Failed to check processing status');
        }
      }
    };
    
    // Start polling after a short delay
    setTimeout(poll, 2000);
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

          {/* Processing Settings */}
          <div className="mb-6 grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Min Frequency (Hz)</label>
              <input type="number" value={options.minFreq ?? 70} onChange={(e) => setOptions((o) => ({ ...o, minFreq: Number(e.target.value) }))} className="w-full px-3 py-2 bg-white/10 border border-purple-400/50 rounded text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Max Frequency (Hz)</label>
              <input type="number" value={options.maxFreq ?? 1500} onChange={(e) => setOptions((o) => ({ ...o, maxFreq: Number(e.target.value) }))} className="w-full px-3 py-2 bg-white/10 border border-purple-400/50 rounded text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Sensitivity</label>
              <input type="range" min={0.001} max={0.05} step={0.001} value={options.amplitudeThreshold ?? 0.01} onChange={(e) => setOptions((o) => ({ ...o, amplitudeThreshold: Number(e.target.value) }))} className="w-full" />
            </div>
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={useCache} onChange={(e) => setUseCache(e.target.checked)} />
                Use cache
              </label>
              <button onClick={() => { clearAllCache(); toast.success('Cache cleared'); }} className="ml-auto px-3 py-2 bg-white/10 border border-purple-400/50 rounded text-sm hover:bg-white/20">Clear cache</button>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleProcess}
              disabled={!uploadedFile || isProcessing || isSeparatingStems}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center"
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
            
            <button
              onClick={handleStemSeparation}
              disabled={!uploadedFile || isProcessing || isSeparatingStems}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center"
            >
              {isSeparatingStems ? (
                <div className="flex flex-col items-center">
                  <div className="flex items-center mb-1">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Separating Stems...
                  </div>
                  {stemJobStatus && (
                    <div className="text-xs text-blue-200">
                      {stemJobStatus}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Music className="h-5 w-5 mr-2" />
                  Separate Stems
                </>
              )}
            </button>
          </div>
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

        {stems && (
          <div className="max-w-6xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-6 text-center">Separated Stems</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(stems).map(([stemType, stemUrl]) => (
                <div key={stemType} className="bg-white/5 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-purple-400 capitalize">{stemType}</h3>
                  {stemUrl ? (
                    <div className="space-y-2">
                      <audio controls className="w-full">
                        <source src={stemUrl} type="audio/wav" />
                        Your browser does not support the audio element.
                      </audio>
                      <a 
                        href={stemUrl} 
                        download={`${stemType}.wav`}
                        className="block text-center text-sm bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded transition-colors"
                      >
                        Download {stemType}
                      </a>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No {stemType} stem available</p>
                  )}
                </div>
              ))}
            </div>
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

