// src/hooks/useAudioEngine.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioSource, getAudioEngine } from "@/lib/audioEngine";

export function useAudioEngine() {
  const engineRef = useRef(getAudioEngine());
  const [ready, setReady] = useState(engineRef.current.ready);
  const [state, setState] = useState(engineRef.current.state);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctx = engineRef.current.context;
    const onState = () => {
      const newState = ctx.state;
      console.debug("[useAudioEngine] AudioContext state changed", { state: newState });
      setState(newState);
    };
    ctx.addEventListener?.("statechange", onState);
    return () => {
      ctx.removeEventListener?.("statechange", onState);
    };
  }, []);

  const load = useCallback(async (src: AudioSource) => {
    console.debug("[useAudioEngine] Loading audio source", { type: src.type });
    setError(null);
    try {
      await engineRef.current.load(src);
      setReady(true);
      console.debug("[useAudioEngine] Audio loaded successfully");
    } catch (e: any) {
      const errorMsg = e?.message ?? String(e);
      console.error("[useAudioEngine] Load failed", errorMsg, e);
      setError(errorMsg);
      setReady(false);
    }
  }, []);

  const play = useCallback(async () => {
    console.debug("[useAudioEngine] Play requested");
    setError(null);
    try {
      await engineRef.current.play();
      console.debug("[useAudioEngine] Playback started");
    } catch (e: any) {
      const errorMsg = e?.message ?? String(e);
      console.error("[useAudioEngine] Play failed", errorMsg, e);
      setError(errorMsg);
    }
  }, []);

  const pause = useCallback(() => {
    console.debug("[useAudioEngine] Pause requested");
    engineRef.current.pause();
  }, []);

  const stop = useCallback(() => {
    console.debug("[useAudioEngine] Stop requested");
    engineRef.current.stop();
  }, []);

  const setVolume = useCallback((v: number) => {
    console.debug("[useAudioEngine] Volume change requested", { volume: v });
    engineRef.current.setVolume(v);
  }, []);

  return { load, play, pause, stop, setVolume, ready, state, error };
}