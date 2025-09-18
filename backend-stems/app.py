import os
import tempfile
import zipfile
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

import torch
import numpy as np
import soundfile as sf

from separators.demucs_sep import DemucsSeparator
from music_tab_generator import generate_tabs_for_file


app = FastAPI(title="Riffraff Stem Separation", version="1.0.0")


TARGET_SAMPLE_RATE = 44100
_inference_device = "cuda" if torch.cuda.is_available() else "cpu"

# Initialize the separator
sep = DemucsSeparator(sr=TARGET_SAMPLE_RATE)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "device": _inference_device, "model": sep.model_name}


@app.post("/separate")
async def separate(file: UploadFile = File(...), sr: int = TARGET_SAMPLE_RATE):
    if file is None or file.filename is None or file.filename.strip() == "":
        raise HTTPException(status_code=400, detail="No file provided")

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save uploaded file
            input_path = Path(tmp_dir) / file.filename
            file_bytes = await file.read()
            with open(input_path, "wb") as f:
                f.write(file_bytes)

            # Run separation
            out = sep.separate_from_path(
                str(input_path), 
                segment=int(os.getenv("SEGMENT_SEC", "60")),
                overlap=float(os.getenv("OVERLAP", "0.1")),
                shifts=int(os.getenv("SHIFTS", "0"))
            )
            
            # Write stems - arrays are [channels, samples]
            guitar_path = Path(tmp_dir) / "guitar.wav"
            others_path = Path(tmp_dir) / "others.wav"
            sf.write(str(guitar_path), out["guitar"].T, sr, subtype="PCM_16")
            sf.write(str(others_path), out["others"].T, sr, subtype="PCM_16")

            # Generate tablature
            try:
                tabs_html = Path(tmp_dir) / "tabs.html"
                generate_tabs_for_file(str(guitar_path), str(tabs_html))
            except Exception as e:
                # Fallback: create a simple HTML
                tabs_html = Path(tmp_dir) / "tabs.html"
                tabs_html.write_text(
                    f"""<html><body>
                    <h3>Tabs placeholder</h3>
                    <p>Could not run music-tab-generator: {e}</p>
                    <p><a href="guitar.wav" download>Download guitar.wav</a></p>
                    </body></html>""", 
                    encoding='utf-8'
                )

            # Create zip
            zip_path = Path(tmp_dir) / "stems_tabs.zip"
            with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.write(guitar_path, arcname="guitar.wav")
                zf.write(others_path, arcname="others.wav")
                zf.write(tabs_html, arcname="tabs.html")

            return FileResponse(str(zip_path), media_type="application/zip", filename="stems_tabs.zip")

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Separation failed: {exc}")

