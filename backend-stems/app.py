import os
import tempfile
import zipfile
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

import torch
import numpy as np
import soundfile as sf

from demucs.pretrained import get_model
from demucs.audio import AudioFile
from demucs.apply import apply_model


app = FastAPI(title="Riffraff Stem Separation", version="1.0.0")


MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs_quantized")
TARGET_SAMPLE_RATE = 44100
TARGET_NUM_CHANNELS = 2

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
def _preload_model_on_startup() -> None:
    # Preload to avoid first-request cold start and potential timeouts
    try:
        load_demucs_model()
    except Exception:
        # Still allow the app to start; /health will indicate model name and device
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

            reference_channel = audio.mean(0)
            audio = (audio - reference_channel.mean()) / (reference_channel.std() + 1e-8)

            audio_tensor = torch.tensor(audio, dtype=torch.float32, device=_inference_device)
            audio_tensor = audio_tensor.unsqueeze(0)  # [batch=1, channels, samples]

            with torch.no_grad():
                # Output shape: [sources, channels, samples]
                separated_sources = apply_model(
                    model,
                    audio_tensor,
                    split=True,  # chunked inference to reduce memory
                    overlap=0.25,
                )[0].to("cpu")

            source_names = getattr(model, "sources", ["drums", "bass", "other", "vocals"])  # type: ignore[attr-defined]

            saved_paths = []
            for source_index, source_name in enumerate(source_names):
                stem_tensor = separated_sources[source_index]
                # De-normalize
                stem_tensor = stem_tensor * (reference_channel.std() + 1e-8) + reference_channel.mean()
                stem_np = stem_tensor.transpose(0, 1).numpy()  # [samples, channels]

                out_path = os.path.join(tmp_dir, f"{source_name}.wav")
                sf.write(out_path, stem_np, TARGET_SAMPLE_RATE)
                saved_paths.append(out_path)

            zip_path = os.path.join(tmp_dir, "stems.zip")
            with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
                for path in saved_paths:
                    zf.write(path, arcname=os.path.basename(path))

            # Return the zip file as the response
            return FileResponse(zip_path, media_type="application/zip", filename="stems.zip")

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Separation failed: {exc}")

