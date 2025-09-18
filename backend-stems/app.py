import os
import tempfile
import zipfile
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
import asyncio
from fastapi.responses import FileResponse

import torch
import numpy as np
import wave

from demucs.pretrained import get_model
from demucs.audio import AudioFile
from demucs.apply import apply_model


app = FastAPI(title="Riffraff Stem Separation", version="1.0.0")


MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs_ft")  # Use fine-tuned model for better quality
TARGET_SAMPLE_RATE = 44100
TARGET_NUM_CHANNELS = 2
MAX_DURATION_SECONDS = int(os.environ.get("MAX_DURATION_SECONDS", "15"))
USE_FLOAT32 = os.environ.get("USE_FLOAT32", "true").lower() == "true"

_loaded_model = None
_inference_device = "cuda" if torch.cuda.is_available() else "cpu"
try:
    torch.set_num_threads(max(1, int(os.environ.get("TORCH_NUM_THREADS", "1"))))
except Exception:
    pass


def load_demucs_model():
    global _loaded_model
    if _loaded_model is None:
        model = get_model(MODEL_NAME)
        model.to(_inference_device)
        model.eval()
        _loaded_model = model
    return _loaded_model


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "device": _inference_device, "model": MODEL_NAME}


@app.on_event("startup")
async def _preload_model_on_startup() -> None:
    # Preload in a background thread to avoid blocking readiness
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, load_demucs_model)
    except Exception:
        # Allow app to start even if preload fails; first request will attempt to load
        pass


@app.post("/separate")
async def separate(file: UploadFile = File(...)):
    if file is None or file.filename is None or file.filename.strip() == "":
        raise HTTPException(status_code=400, detail="No file provided")

    try:
        model = load_demucs_model()

        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, file.filename)
            file_bytes = await file.read()
            with open(input_path, "wb") as f:
                f.write(file_bytes)

            # Read and normalize audio
            audio = AudioFile(input_path).read(
                streams=0, samplerate=TARGET_SAMPLE_RATE, channels=TARGET_NUM_CHANNELS
            )

            # Cap duration to reduce CPU/RAM usage on small instances
            if audio.shape[1] > TARGET_SAMPLE_RATE * MAX_DURATION_SECONDS:
                audio = audio[:, : TARGET_SAMPLE_RATE * MAX_DURATION_SECONDS]

            # Improved normalization to preserve dynamics
            # Use RMS normalization instead of z-score normalization
            rms = np.sqrt(np.mean(audio ** 2))
            if rms > 1e-8:  # Avoid division by zero
                audio = audio / (rms * 3.0)  # Scale to prevent clipping while preserving dynamics
            
            # Store original statistics for denormalization
            original_rms = rms

            # Convert to tensor with appropriate dtype
            tensor_dtype = torch.float32 if USE_FLOAT32 else torch.float16
            audio_tensor = torch.tensor(audio, dtype=tensor_dtype, device=_inference_device)
            audio_tensor = audio_tensor.unsqueeze(0)  # [batch=1, channels, samples]

            with torch.no_grad():
                # Output shape: [sources, channels, samples]
                separated_sources = apply_model(
                    model,
                    audio_tensor,
                    split=True,  # chunked inference to reduce memory
                    overlap=0.25,  # Increased overlap for smoother transitions
                    shifts=2,      # Use multiple shifts and average for better quality
                )[0].to("cpu")

            source_names = getattr(model, "sources", ["drums", "bass", "other", "vocals"])  # type: ignore[attr-defined]

            saved_paths = []
            for source_index, source_name in enumerate(source_names):
                stem_tensor = separated_sources[source_index]
                
                # Improved de-normalization using original RMS
                if original_rms > 1e-8:
                    stem_tensor = stem_tensor * (original_rms * 3.0)
                
                stem_np = stem_tensor.transpose(0, 1).numpy()  # [samples, channels]
                
                # Apply soft clipping to reduce harsh artifacts
                stem_np = np.tanh(stem_np * 0.9) * 1.1  # Soft saturation
                stem_np = np.clip(stem_np, -1.0, 1.0)

                out_path = os.path.join(tmp_dir, f"{source_name}.wav")
                
                if USE_FLOAT32:
                    # Save as 32-bit float WAV for maximum quality
                    try:
                        import soundfile as sf
                        sf.write(out_path, stem_np, TARGET_SAMPLE_RATE, subtype='FLOAT')
                    except ImportError:
                        # Fallback to 24-bit if soundfile not available
                        with wave.open(out_path, "wb") as wf:
                            wf.setnchannels(TARGET_NUM_CHANNELS)
                            wf.setsampwidth(3)  # 24-bit
                            wf.setframerate(TARGET_SAMPLE_RATE)
                            pcm = (stem_np * 8388607.0).astype(np.int32)
                            # Convert to 24-bit
                            pcm_bytes = []
                            for sample in pcm.flatten():
                                pcm_bytes.extend(sample.to_bytes(4, 'little', signed=True)[:3])
                            wf.writeframes(bytes(pcm_bytes))
                else:
                    # Standard 16-bit output with improved quantization
                    pcm = (stem_np * 32767.0).astype(np.int16)
                    with wave.open(out_path, "wb") as wf:
                        wf.setnchannels(TARGET_NUM_CHANNELS)
                        wf.setsampwidth(2)  # 16-bit
                        wf.setframerate(TARGET_SAMPLE_RATE)
                        wf.writeframes(pcm.tobytes())
                
                saved_paths.append(out_path)

            zip_path = os.path.join(tmp_dir, "stems.zip")
            with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
                for path in saved_paths:
                    zf.write(path, arcname=os.path.basename(path))

            # Return the zip file as the response
            return FileResponse(zip_path, media_type="application/zip", filename="stems.zip")

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Separation failed: {exc}")

