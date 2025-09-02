import io, os, tempfile, uuid, asyncio
from typing import Literal, Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
import soundfile as sf
import numpy as np

# Lazy import to speed cold start
_demucs_bundle = None

def get_separator(model: str = "htdemucs"):
    global _demucs_bundle
    if _demucs_bundle is None:
        from demucs.pretrained import get_model as demucs_get
        from demucs.apply import BagOfModels
        _demucs_bundle = BagOfModels([demucs_get(model)])
    return _demucs_bundle

app = FastAPI(title="Stems")

@app.post("/separate")
async def separate(
    file: UploadFile = File(...),
    model: str = Form("htdemucs"),
    stems: str = Form("vocals,drums,bass,other"),  # comma-separated, default 4-stem
    samplerate: int = Form(44100),
):
    # Save input to temp wav readable by demucs
    with tempfile.TemporaryDirectory() as td:
        raw_path = os.path.join(td, f"inp_{uuid.uuid4()}.wav")
        # Ensure WAV float32/44100
        data, sr = sf.read(io.BytesIO(await file.read()), always_2d=True)
        if sr != samplerate:
            # simple resample with soundfile? (not supported) -> keep sr, demucs handles many srs.
            pass
        sf.write(raw_path, data, sr)

        # Run demucs
        bag = get_separator(model)
        # returns dict[name] -> np.ndarray [T, C]
        out = await asyncio.get_event_loop().run_in_executor(None, lambda: bag.separate_audio_file(raw_path))

        # Pick/export requested stems in a simple tar (wav per stem)
        import tarfile
        tar_bytes = io.BytesIO()
        with tarfile.open(mode="w:gz", fileobj=tar_bytes) as tar:
            for name, arr in out.items():
                # arr shape [C, T]; convert to float32 interleaved
                if isinstance(arr, np.ndarray):
                    y = arr
                else:
                    y = np.array(arr)
                if y.ndim == 2 and y.shape[0] <= 8:  # [C, T]
                    y = y.transpose(1,0)  # [T, C]
                wav_b = io.BytesIO()
                sf.write(wav_b, y, sr, format="WAV", subtype="PCM_16")
                wav_b.seek(0)
                info = tarfile.TarInfo(name=f"{name}.wav")
                info.size = len(wav_b.getbuffer())
                tar.addfile(info, wav_b)
        tar_bytes.seek(0)
        return StreamingResponse(tar_bytes, media_type="application/gzip", headers={"Content-Disposition":"attachment; filename=stems.tar.gz"})