"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Download, 
  SkipBack, 
  SkipForward,
  RotateCcw,
  Share,
  Music
} from 'lucide-react';
import { ClientStemSeparator } from '@/lib/clientStemSeparator';
import { toast } from 'sonner';

interface SeparatedStems {
  vocals: AudioBuffer | null;
  drums: AudioBuffer | null;
  bass: AudioBuffer | null;
  other: AudioBuffer | null;
  original: AudioBuffer | null;
}

interface ProfessionalAudioInterfaceProps {
  originalAudio: AudioBuffer;
  fileName?: string;
  onExport?: (stems: SeparatedStems) => void;
}

export function ProfessionalAudioInterface({ 
  originalAudio, 
  fileName = "audio-file",
  onExport 
}: ProfessionalAudioInterfaceProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(originalAudio.duration);
  const [volumes, setVolumes] = useState({
    vocals: 100,
    drums: 100,
    bass: 100,
    other: 100,
    original: 0
  });
  
  const [mutedTracks, setMutedTracks] = useState({
    vocals: false,
    drums: false,
    bass: false,
    other: false,
    original: true
  });

  const [separatedStems, setSeparatedStems] = useState<SeparatedStems>({
    vocals: null,
    drums: null,
    bass: null,
    other: null,
    original: originalAudio
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [separationProgress, setSeparationProgress] = useState(0);
  const [detectedBPM, setDetectedBPM] = useState<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const animationFrameRef = useRef<number>();

  const trackConfigs = [
    {
      id: 'vocals',
      name: 'Vocals',
      color: 'bg-cyan-400',
      waveformData: generateWaveformData(1000, 'vocals'),
    },
    {
      id: 'drums',
      name: 'Drums', 
      color: 'bg-cyan-400',
      waveformData: generateWaveformData(1000, 'drums'),
    },
    {
      id: 'bass',
      name: 'Bass',
      color: 'bg-cyan-400', 
      waveformData: generateWaveformData(1000, 'bass'),
    },
    {
      id: 'other',
      name: 'Other',
      color: 'bg-cyan-400',
      waveformData: generateWaveformData(1000, 'other'),
    },
    {
      id: 'original',
      name: 'Original',
      color: 'bg-gray-400',
      waveformData: generateWaveformData(1000, 'original'),
    }
  ];

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create gain nodes for each track
    trackConfigs.forEach(track => {
      const gainNode = audioContextRef.current!.createGain();
      gainNode.connect(audioContextRef.current!.destination);
      gainNodesRef.current.set(track.id, gainNode);
    });

    // Estimate BPM from original audio
    estimateBPM(originalAudio);

    return () => {
      stopAllTracks();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update gain nodes when volumes change
  useEffect(() => {
    Object.entries(volumes).forEach(([trackId, volume]) => {
      const gainNode = gainNodesRef.current.get(trackId);
      if (gainNode) {
        const normalizedVolume = mutedTracks[trackId as keyof typeof mutedTracks] ? 0 : volume / 100;
        gainNode.gain.setValueAtTime(normalizedVolume, audioContextRef.current!.currentTime);
      }
    });
  }, [volumes, mutedTracks]);

  const estimateBPM = (audioBuffer: AudioBuffer) => {
    // Simple BPM estimation based on audio analysis
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Analyze beats using simple onset detection
    let beats = 0;
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
    
    for (let i = windowSize; i < channelData.length - windowSize; i += windowSize) {
      const current = getRMS(channelData.slice(i, i + windowSize));
      const previous = getRMS(channelData.slice(i - windowSize, i));
      
      if (current > previous * 1.3) {
        beats++;
      }
    }
    
    const durationInMinutes = audioBuffer.duration / 60;
    const estimatedBPM = Math.round(beats / durationInMinutes);
    setDetectedBPM(estimatedBPM);
  };

  const getRMS = (data: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  };

  const separateAllStems = async () => {
    if (!originalAudio) return;
    
    setIsProcessing(true);
    setSeparationProgress(0);
    toast.info('Starting stem separation...');

    try {
      const separator = new ClientStemSeparator();
      const newStems: SeparatedStems = {
        vocals: null,
        drums: null,
        bass: null,
        other: null,
        original: originalAudio
      };

      // Separate each stem type
      const stemTypes = ['vocals', 'drums', 'bass', 'other'];
      
      for (let i = 0; i < stemTypes.length; i++) {
        const stemType = stemTypes[i];
        console.log(`🎵 Separating ${stemType}...`);
        
        const stemBuffer = await separator.separateStems(
          originalAudio, 
          stemType,
          (progress) => {
            const overallProgress = (i * 25) + (progress * 0.25);
            setSeparationProgress(overallProgress);
          }
        );
        
        console.log(`✅ ${stemType} separation complete:`, {
          duration: stemBuffer.duration,
          channels: stemBuffer.numberOfChannels,
          sampleRate: stemBuffer.sampleRate,
          // Log a sample of the audio data to verify it's different
          firstSamples: Array.from(stemBuffer.getChannelData(0).slice(0, 10))
        });
        
        newStems[stemType as keyof SeparatedStems] = stemBuffer;
      }

      setSeparatedStems(newStems);
      setSeparationProgress(100);
      toast.success('All stems separated successfully!');
      
      // Enable vocals and drums by default, mute original
      setMutedTracks(prev => ({
        ...prev,
        original: true,
        vocals: false,
        drums: false
      }));

    } catch (error) {
      console.error('Stem separation failed:', error);
      toast.error('Stem separation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const playAllTracks = async () => {
    if (!audioContextRef.current) return;
    
    await audioContextRef.current.resume();
    stopAllTracks();
    
    const startTime = audioContextRef.current.currentTime;
    
    // Play each track that has audio and isn't muted
    trackConfigs.forEach(track => {
      const audioBuffer = separatedStems[track.id as keyof SeparatedStems];
      if (audioBuffer && !mutedTracks[track.id as keyof typeof mutedTracks]) {
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        
        const gainNode = gainNodesRef.current.get(track.id);
        if (gainNode) {
          source.connect(gainNode);
        }
        
        source.start(startTime, currentTime);
        sourceNodesRef.current.set(track.id, source);
        
        // Handle end of playback
        source.onended = () => {
          if (sourceNodesRef.current.get(track.id) === source) {
            sourceNodesRef.current.delete(track.id);
            if (sourceNodesRef.current.size === 0) {
              setIsPlaying(false);
              setCurrentTime(0);
            }
          }
        };
      }
    });
    
    setIsPlaying(true);
    startTimeUpdate();
  };

  const stopAllTracks = () => {
    sourceNodesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source may already be stopped
      }
    });
    sourceNodesRef.current.clear();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const startTimeUpdate = () => {
    const update = () => {
      if (isPlaying && audioContextRef.current) {
        setCurrentTime(prev => {
          const newTime = prev + 0.1;
          return newTime >= duration ? duration : newTime;
        });
        animationFrameRef.current = requestAnimationFrame(update);
      }
    };
    update();
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopAllTracks();
      setIsPlaying(false);
    } else {
      playAllTracks();
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (isPlaying) {
      stopAllTracks();
      // Restart playback from new position
      setTimeout(() => playAllTracks(), 10);
    }
  };

  const handleVolumeChange = (trackId: string, volume: number) => {
    setVolumes((prev: typeof volumes) => ({ ...prev, [trackId]: volume }));
  };

  const handleMuteToggle = (trackId: string) => {
    setMutedTracks((prev: typeof mutedTracks) => ({ ...prev, [trackId]: !prev[trackId as keyof typeof prev] }));
  };

  const handleReset = () => {
    stopAllTracks();
    setCurrentTime(0);
    setIsPlaying(false);
    setVolumes({
      vocals: 100,
      drums: 100,
      bass: 100,
      other: 100,
      original: 0
    });
    setMutedTracks({
      vocals: false,
      drums: false,
      bass: false,
      other: false,
      original: true
    });
  };

  const handleExport = () => {
    if (onExport) {
      onExport(separatedStems);
    }
    toast.success('Stems exported successfully!');
  };

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col">
      {/* Top Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleReset}
            className="p-2 hover:bg-slate-700 rounded"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <div className="text-white font-medium">
            {fileName}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={separateAllStems}
            disabled={isProcessing}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 rounded-lg font-medium flex items-center"
          >
            <span className="mr-2">🎵</span>
            {isProcessing ? `Separating... ${Math.round(separationProgress)}%` : 'Separate tracks'}
          </button>
          {detectedBPM && (
            <div className="flex items-center space-x-2 bg-slate-700 rounded-lg px-3 py-2">
              <span>{detectedBPM}</span>
              <span className="text-slate-400">BPM</span>
            </div>
          )}
          <button 
            onClick={handleExport}
            className="p-2 hover:bg-slate-700 rounded flex items-center"
          >
            <Download className="h-5 w-5" />
            <span className="ml-2">Export</span>
          </button>
        </div>
      </div>

      {/* Progress Bar (when processing) */}
      {isProcessing && (
        <div className="w-full bg-gray-700 h-1">
          <div 
            className="bg-gradient-to-r from-cyan-400 to-purple-400 h-1 transition-all duration-300"
            style={{ width: `${separationProgress}%` }}
          />
        </div>
      )}

      {/* Main Waveform Area */}
      <div className="flex-1 flex">
        {/* Track Controls Sidebar */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4">
          <div className="space-y-4">
            {trackConfigs.map((track) => (
              <TrackControl
                key={track.id}
                track={track}
                volume={volumes[track.id as keyof typeof volumes]}
                isMuted={mutedTracks[track.id as keyof typeof mutedTracks]}
                hasAudio={!!separatedStems[track.id as keyof SeparatedStems]}
                onVolumeChange={(volume) => handleVolumeChange(track.id, volume)}
                onMuteToggle={() => handleMuteToggle(track.id)}
              />
            ))}
          </div>
          
          <button 
            onClick={handleReset}
            className="w-full mt-8 py-2 text-cyan-400 hover:bg-slate-700 rounded"
          >
            Reset
          </button>
        </div>

        {/* Waveform Display */}
        <div className="flex-1 bg-slate-900 relative">
          {/* Timeline */}
          <div className="h-12 bg-slate-800 border-b border-slate-700 relative">
            <TimelineRuler 
              duration={duration} 
              currentTime={currentTime}
              onSeek={handleSeek}
            />
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          
          {/* Waveforms */}
          <div className="flex-1 relative">
            {trackConfigs.map((track, index) => (
              <WaveformTrack
                key={track.id}
                track={track}
                height={120}
                top={index * 120}
                currentTime={currentTime}
                duration={duration}
                volume={volumes[track.id as keyof typeof volumes]}
                isMuted={mutedTracks[track.id as keyof typeof mutedTracks]}
                audioBuffer={separatedStems[track.id as keyof SeparatedStems]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-slate-800 border-t border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => handleSeek(0)}
              className="p-3 hover:bg-slate-700 rounded-full"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            
            <button 
              onClick={handlePlayPause}
              className="p-4 bg-cyan-500 hover:bg-cyan-600 rounded-full"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            
            <button 
              onClick={() => handleSeek(duration)}
              className="p-3 hover:bg-slate-700 rounded-full"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            
            <div className="text-sm text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
              Lyrics
            </button>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
              Chords  
            </button>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
              Sections
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Track Control Component
interface TrackControlProps {
  track: any;
  volume: number;
  isMuted: boolean;
  hasAudio: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
}

function TrackControl({ 
  track, 
  volume, 
  isMuted, 
  hasAudio, 
  onVolumeChange, 
  onMuteToggle 
}: TrackControlProps) {
  return (
    <div className={`rounded-lg p-3 ${hasAudio ? 'bg-slate-700' : 'bg-slate-700/50'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">{track.name}</span>
          {hasAudio && <div className="w-2 h-2 bg-green-400 rounded-full" />}
        </div>
        <button 
          onClick={onMuteToggle}
          className={`p-1 rounded ${isMuted ? 'text-slate-500' : 'text-white'}`}
          disabled={!hasAudio}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none slider-cyan"
          disabled={isMuted || !hasAudio}
        />
        <span className="text-xs text-slate-400 w-8">{volume}</span>
      </div>
    </div>
  );
}

// Waveform Track Component
interface WaveformTrackProps {
  track: any;
  height: number;
  top: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  audioBuffer: AudioBuffer | null;
}

function WaveformTrack({ 
  track, 
  height, 
  top, 
  currentTime, 
  duration, 
  volume, 
  isMuted, 
  audioBuffer 
}: WaveformTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const heightValue = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, heightValue);
    
    let waveformData: Float32Array;
    
    if (audioBuffer) {
      // Use actual audio data
      const channelData = audioBuffer.getChannelData(0);
      const samplesPerPixel = Math.floor(channelData.length / width);
      waveformData = new Float32Array(width);
      
      for (let i = 0; i < width; i++) {
        const start = i * samplesPerPixel;
        const end = Math.min(start + samplesPerPixel, channelData.length);
        let max = 0;
        
        for (let j = start; j < end; j++) {
          max = Math.max(max, Math.abs(channelData[j]));
        }
        
        waveformData[i] = max;
      }
    } else {
      // Use placeholder data
      waveformData = track.waveformData;
    }
    
    // Draw waveform
    ctx.strokeStyle = isMuted ? '#64748b' : '#06b6d4'; // slate-500 or cyan-500
    ctx.fillStyle = isMuted ? '#64748b' : '#06b6d4';
    ctx.lineWidth = 1;
    ctx.globalAlpha = isMuted ? 0.3 : (volume / 100);
    
    ctx.beginPath();
    waveformData.forEach((point, index) => {
      const x = (index / waveformData.length) * width;
      const y = heightValue / 2 + (point * heightValue / 2 * 0.8);
      
      if (index === 0) {
        ctx.moveTo(x, heightValue / 2);
      }
      ctx.lineTo(x, y);
      ctx.lineTo(x, heightValue - y + heightValue / 2);
    });
    
    ctx.globalAlpha = isMuted ? 0.1 : (volume / 100) * 0.3;
    ctx.fill();
    
  }, [track.waveformData, volume, isMuted, audioBuffer]);
  
  return (
    <div 
      className="absolute left-0 right-0 border-b border-slate-700 flex items-center"
      style={{ height: `${height}px`, top: `${top}px` }}
    >
      <div className="w-full h-full relative">
        <canvas
          ref={canvasRef}
          width={1200}
          height={height}
          className="w-full h-full"
        />
        {!audioBuffer && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
            Click "Separate tracks" to generate {track.name.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}

// Timeline Ruler Component
interface TimelineRulerProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

function TimelineRuler({ duration, currentTime, onSeek }: TimelineRulerProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  const markers = [];
  const interval = Math.max(10, Math.floor(duration / 10)); // Dynamic interval
  
  for (let i = 0; i <= duration; i += interval) {
    markers.push(
      <div 
        key={i}
        className="absolute top-0 bottom-0 w-px bg-slate-600"
        style={{ left: `${(i / duration) * 100}%` }}
      >
        <span className="absolute top-1 text-xs text-slate-400 -translate-x-1/2">
          {formatTime(i)}
        </span>
      </div>
    );
  }
  
  return (
    <div 
      className="relative h-full cursor-pointer" 
      onClick={handleClick}
    >
      {markers}
    </div>
  );
}

// Helper Functions
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function generateWaveformData(points: number, type: string): Float32Array {
  // Generate realistic waveform data for different instrument types
  return new Float32Array(Array.from({ length: points }, (_, i) => {
    let wave = 0;
    
    switch (type) {
      case 'vocals':
        // Vocal-like pattern with mid-frequency emphasis
        wave = Math.sin(i * 0.02) * 0.6 + Math.sin(i * 0.05) * 0.3;
        break;
      case 'drums':
        // Percussive spikes
        wave = Math.random() > 0.95 ? Math.random() * 2 - 1 : Math.sin(i * 0.1) * 0.2;
        break;
      case 'bass':
        // Low frequency, steady pattern
        wave = Math.sin(i * 0.01) * 0.8 + Math.sin(i * 0.02) * 0.2;
        break;
      case 'other':
        // Mixed instruments
        wave = Math.sin(i * 0.03) * 0.4 + Math.sin(i * 0.07) * 0.3 + Math.random() * 0.1;
        break;
      default:
        // Original - full mix
        wave = Math.sin(i * 0.02) * 0.5 + Math.sin(i * 0.05) * 0.3 + Math.random() * 0.2;
    }
    
    return wave * Math.random() * 0.8; // Add some randomness
  }));
}