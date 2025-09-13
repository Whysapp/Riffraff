import { useState } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAudioEngine } from "@/hooks/useAudioEngine";

export function PlayerControls({
  getPlaybackSource,
}: {
  /** Return the latest audio source (buffer/blob/url) to play. */
  getPlaybackSource: () => import("@/lib/audioEngine").AudioSource | null;
}) {
  const { load, play, pause, stop, setVolume, ready, state, error } = useAudioEngine();
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [volume, setVol] = useState(100);

  const ensureLoaded = async () => {
    console.debug("[PlayerControls] ensureLoaded called", { ready });
    if (ready) return;
    const src = getPlaybackSource();
    console.debug("[PlayerControls] Got playback source", { src: src ? { type: src.type } : null });
    if (!src) throw new Error("No audio to play (generate tablature first)");
    await load(src);
    setLoadedOnce(true);
  };

  const onPlay = async () => {
    console.debug("[PlayerControls] Play button clicked");
    try {
      await ensureLoaded();
      await play();
    } catch (e) {
      console.error("[PlayerControls] Play failed", e);
    }
  };

  const onPause = () => {
    console.debug("[PlayerControls] Pause button clicked");
    pause();
  };

  const onStop = () => {
    console.debug("[PlayerControls] Stop button clicked");
    stop();
  };

  const onVolume = (vals: [number]) => {
    const v = vals[0] ?? 100;
    console.debug("[PlayerControls] Volume changed", { volume: v });
    setVol(v);
    setVolume(v / 100);
  };

  const isDisabled = state === "closed";
  const canControl = ready || loadedOnce;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button 
          onClick={onPlay} 
          disabled={isDisabled}
          className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <Play className="h-4 w-4 mr-2" />
          Play
        </button>
        <button 
          onClick={onPause} 
          disabled={!canControl}
          className="flex items-center px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <Pause className="h-4 w-4 mr-2" />
          Pause
        </button>
        <button 
          onClick={onStop} 
          disabled={!canControl}
          className="flex items-center px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <Square className="h-4 w-4 mr-2" />
          Stop
        </button>
        <span className="ml-4 text-sm opacity-70">AudioContext: {state}</span>
      </div>

      <div className="flex items-center gap-3">
        <Volume2 className="h-4 w-4 text-purple-400" />
        <span className="text-sm w-16">Volume</span>
        <Slider 
          value={[volume]} 
          min={0} 
          max={100} 
          step={1} 
          onValueChange={onVolume}
          className="flex-1 accent-purple-400"
        />
        <span className="text-sm w-10 text-right">{volume}%</span>
      </div>

      {error && (
        <div className="p-2 bg-red-500/20 border border-red-400/40 rounded text-xs text-red-300">
          Playback error: {error}
        </div>
      )}
    </div>
  );
}