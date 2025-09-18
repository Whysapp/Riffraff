# backend-stems/separators/demucs_sep.py
from __future__ import annotations
import os
import torch
import numpy as np
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import AudioFile

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

class DemucsSeparator:
    def __init__(self, model_name: str | None = None, sr: int = 44100):
        self.model_name = model_name or os.environ.get("DEMUCS_MODEL", "htdemucs")
        self.sr = sr
        self.model = None

    def load(self):
        if self.model is None:
            self.model = get_model(self.model_name)
            self.model.to(DEVICE)
            self.model.eval()

    def separate_from_path(self, path: str, *,
                           segment: int = 60,
                           overlap: float = 0.1,
                           shifts: int = 0) -> dict[str, np.ndarray]:
        """
        Returns dict: { 'guitar': np.float32 [channels, samples], 'others': np.float32 }
        """
        self.load()
        # Read audio with demucs AudioFile (resamples to target sr)
        wav = AudioFile(path).read(streams=0, samplerate=self.sr, channels=2)
        # Pre-normalize
        ref = wav.mean(0)
        wav_norm = (wav - ref.mean()) / (ref.std() + 1e-8)
        tensor = torch.tensor(wav_norm, dtype=torch.float32, device=DEVICE).unsqueeze(0)

        with torch.no_grad():
            # apply_model returns (sources, channels, samples)
            sources = apply_model(self.model, tensor,
                                  split=True, overlap=overlap,
                                  shifts=shifts)[0].to("cpu").numpy()

        # sources shape: [n_sources, channels, samples]
        source_names = getattr(self.model, "sources", ["drums", "bass", "other", "vocals"])
        # If model provides 'guitar' or included in htdemucs_6s, map accordingly
        # Strategy: if 'guitar' in names -> use it. else derive approximation from 'other'
        name_to_idx = {n: i for i, n in enumerate(source_names)}
        if "guitar" in name_to_idx:
            guitar = sources[name_to_idx["guitar"]]
            others = (sources.sum(axis=0) - guitar).astype(np.float32)
        else:
            # Heuristic: try to extract guitar from 'other' band
            # Use 'other' if present; else make guitar = vocals*0 (fallback)
            other_idx = name_to_idx.get("other", None)
            if other_idx is None:
                # fallback: treat sum(sources) as others (no guitar)
                total = sources.sum(axis=0)
                guitar = np.zeros_like(total, dtype=np.float32)
                others = total.astype(np.float32)
            else:
                # Use spectral subtraction heuristic:
                # convert 'other' to mono energy and apply midrange emphasis to approximate guitar.
                other = sources[other_idx]
                # Rough heuristic: emphasize 1.5-5kHz region via simple bandpass via FFT
                # (small, fast operation)
                def emphasize_guitar(x):
                    X = np.fft.rfft(x, axis=1)
                    freqs = np.fft.rfftfreq(x.shape[1], d=1.0/self.sr)
                    mask = np.logical_and(freqs >= 1500, freqs <= 5000).astype(np.float32)
                    # apply mild boost in that band
                    X[:, :] = X[:, :] * (1.0 + 1.5 * mask[None, :])
                    y = np.fft.irfft(X, n=x.shape[1], axis=1)
                    return y
                guitar_est = emphasize_guitar(other)
                # clamp and set others = total - guitar_est
                total = sources.sum(axis=0)
                guitar = np.clip(guitar_est, -1.0, 1.0).astype(np.float32)
                others = np.clip(total - guitar, -1.0, 1.0).astype(np.float32)

        # de-normalize by using ref.std/mean (approx)
        # Return as float32 numpy arrays [channels, samples]
        return {"guitar": guitar.astype(np.float32), "others": others.astype(np.float32)}