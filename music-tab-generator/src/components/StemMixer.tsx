import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { StemBlobMap, StemName } from "@/types/stems";
import { getAudioEngine } from "@/lib/audioEngine";
import { Play, Square, Volume2, VolumeX } from "lucide-react";

const STEMS: StemName[] = ["vocals","drums","bass","guitar","piano","other"];

type StemState = {
  gain: number;   // 0..2 (200%)
  mute: boolean;
  solo: boolean;
  available: boolean;
};

export function StemMixer({ stems }: { stems: StemBlobMap }) {
  const engine = useMemo(() => getAudioEngine(), []);
  const [states, setStates] = useState<Record<StemName, StemState>>(
    () => STEMS.reduce((acc, s) => ({...acc, [s]: {gain: 1, mute: false, solo: false, available: !!stems[s]}}), {} as any)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const nodesRef = useRef<{ [K in StemName]?: { source: AudioBufferSourceNode|null, gain: GainNode|null, buffer?: AudioBuffer } }>({});

  useEffect(() => {
    // decode newly arrived blobs
    (async () => {
      for (const s of STEMS) {
        const blob = stems[s];
        if (!blob) continue;
        try {
          const ab = await blob.arrayBuffer();
          const buf = await engine.decodeAudioData(ab);
          nodesRef.current[s] = { ...(nodesRef.current[s]||{}), buffer: buf, source: null, gain: null };
        } catch (error) {
          console.error(`Failed to decode ${s} stem:`, error);
        }
      }
      setStates((prev) => {
        const next = {...prev};
        STEMS.forEach((s) => { next[s].available = !!stems[s]; });
        return next;
      });
    })();
  }, [stems, engine]);

  const startGraph = async () => {
    await engine.ensureResumed();
    stopGraph();
    const soloActive = STEMS.some((s) => states[s].solo);
    
    for (const s of STEMS) {
      const cfg = states[s];
      const entry = nodesRef.current[s];
      if (!entry?.buffer) continue;
      if (soloActive && !cfg.solo) continue;
      if (cfg.mute) continue;

      const g = engine.context.createGain();
      g.gain.value = cfg.gain;
      g.connect(engine.gain);

      const src = engine.context.createBufferSource();
      src.buffer = entry.buffer;
      src.connect(g);
      src.start(0);
      entry.source = src; 
      entry.gain = g;
      
      src.onended = () => {
        setIsPlaying(false);
      };
    }
    setIsPlaying(true);
  };

  const stopGraph = () => {
    for (const s of STEMS) {
      const entry = nodesRef.current[s];
      if (entry?.source) {
        try { 
          entry.source.stop(); 
        } catch (e) {
          // Already stopped
        }
        entry.source.disconnect();
        entry.gain?.disconnect();
        entry.source = null;
        entry.gain = null;
      }
    }
    setIsPlaying(false);
  };

  const onPlay = async () => startGraph();
  const onStop = () => stopGraph();

  const update = (s: StemName, patch: Partial<StemState>) => {
    setStates((prev) => {
      const next = { ...prev, [s]: { ...prev[s], ...patch }};
      
      // Handle solo logic - if enabling solo on one stem, disable on others
      if (patch.solo === true) {
        STEMS.forEach((stem) => {
          if (stem !== s) {
            next[stem] = { ...next[stem], solo: false };
          }
        });
      }
      
      return next;
    });
    
    // Update gain in real-time if playing
    if (isPlaying && patch.gain !== undefined) {
      const entry = nodesRef.current[s];
      if (entry?.gain) {
        entry.gain.gain.value = patch.gain;
      }
    }
  };

  const hasAvailableStems = Object.values(stems).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button 
          onClick={onPlay} 
          disabled={!hasAvailableStems || isPlaying}
          className="flex items-center gap-2"
        >
          <Play className="h-4 w-4" />
          Play Stems
        </Button>
        <Button 
          variant="secondary" 
          onClick={onStop}
          disabled={!isPlaying}
          className="flex items-center gap-2"
        >
          <Square className="h-4 w-4" />
          Stop
        </Button>
        {!hasAvailableStems && (
          <span className="text-sm text-gray-400">No stems generated yet</span>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STEMS.map((s) => {
          const state = states[s];
          return (
            <div key={s} className={`rounded-lg border p-4 transition-all ${
              state.available ? 'border-purple-400/30 bg-white/5' : 'border-gray-600/30 bg-gray-800/20'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium capitalize flex items-center gap-2">
                  {state.mute ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-purple-400" />}
                  {s}
                </span>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant={state.solo ? "default" : "outline"} 
                    onClick={() => update(s, { solo: !state.solo })}
                    disabled={!state.available}
                    className="text-xs px-2 py-1"
                  >
                    Solo
                  </Button>
                  <Button 
                    size="sm" 
                    variant={state.mute ? "default" : "outline"} 
                    onClick={() => update(s, { mute: !state.mute })}
                    disabled={!state.available}
                    className="text-xs px-2 py-1"
                  >
                    Mute
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-xs w-12 text-gray-400">Level</span>
                <Slider 
                  value={[Math.round(state.gain * 100)]} 
                  min={0} 
                  max={200} 
                  step={1}
                  onValueChange={([v]) => update(s, { gain: (v ?? 100) / 100 })}
                  disabled={!state.available}
                  className="flex-1"
                />
                <span className="text-xs w-10 text-right text-gray-400">
                  {Math.round(state.gain * 100)}%
                </span>
              </div>
              
              {!state.available && (
                <p className="mt-2 text-xs text-gray-500">Not generated</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}