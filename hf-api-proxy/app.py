"""
HuggingFace API Proxy Service
Provides endpoints to interact with HuggingFace Spaces using gradio_client
"""

import os
import tempfile
import asyncio
from typing import Optional, Dict, Any
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Import gradio_client for HuggingFace Spaces API calls
try:
    from gradio_client import Client
except ImportError:
    print("Warning: gradio_client not installed. Install with: pip install gradio_client")
    Client = None

app = FastAPI(title="HuggingFace API Proxy", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# HuggingFace Space URLs
STEM_SEPARATION_SPACE = "ahk-d/Spleeter-HT-Demucs-Stem-Separation-2025"
GUITAR_TABS_SPACE = "JonathanJH/guitar-tabs-ai"

# Cache clients to avoid repeated initialization
_stem_client = None
_tabs_client = None

def get_stem_client():
    global _stem_client
    if _stem_client is None and Client is not None:
        try:
            _stem_client = Client(STEM_SEPARATION_SPACE)
            logger.info(f"Initialized stem separation client for {STEM_SEPARATION_SPACE}")
        except Exception as e:
            logger.error(f"Failed to initialize stem separation client: {e}")
    return _stem_client

def get_tabs_client():
    global _tabs_client
    if _tabs_client is None and Client is not None:
        try:
            _tabs_client = Client(GUITAR_TABS_SPACE)
            logger.info(f"Initialized guitar tabs client for {GUITAR_TABS_SPACE}")
        except Exception as e:
            logger.error(f"Failed to initialize guitar tabs client: {e}")
    return _tabs_client

@app.get("/health")
async def health():
    return {"status": "ok", "gradio_client_available": Client is not None}

@app.post("/separate-stems")
async def separate_stems(file: UploadFile = File(...)):
    """Separate audio stems using HuggingFace Spleeter-HT-Demucs Space"""
    if not Client:
        raise HTTPException(status_code=500, detail="gradio_client not available")
    
    client = get_stem_client()
    if not client:
        raise HTTPException(status_code=500, detail="Failed to initialize stem separation client")
    
    try:
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        logger.info(f"Processing file: {file.filename} ({len(content)} bytes)")
        
        # Call the HuggingFace Space
        result = client.predict(
            temp_file_path,  # Input audio file
            api_name="/predict"  # This might need adjustment based on the actual API
        )
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        # Process the result - format may vary
        if isinstance(result, (list, tuple)) and len(result) > 0:
            # Assuming the result contains file paths or URLs to the separated stems
            stems_data = result[0] if isinstance(result[0], dict) else {}
            
            return {
                "success": True,
                "stems": stems_data,
                "message": "Stem separation completed successfully"
            }
        else:
            return {
                "success": False,
                "error": "Unexpected response format from stem separation API",
                "raw_result": str(result)
            }
            
    except Exception as e:
        logger.error(f"Stem separation error: {e}")
        # Clean up temp file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        raise HTTPException(status_code=500, detail=f"Stem separation failed: {str(e)}")

@app.post("/generate-tablature")
async def generate_tablature(file: UploadFile = File(...)):
    """Generate guitar tablature using HuggingFace Guitar Tabs AI Space"""
    if not Client:
        raise HTTPException(status_code=500, detail="gradio_client not available")
    
    client = get_tabs_client()
    if not client:
        raise HTTPException(status_code=500, detail="Failed to initialize guitar tabs client")
    
    try:
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        logger.info(f"Processing file for tablature: {file.filename} ({len(content)} bytes)")
        
        # Call the HuggingFace Space
        result = client.predict(
            temp_file_path,  # Input audio file
            api_name="/predict"  # This might need adjustment based on the actual API
        )
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        # Process the result - format may vary
        if isinstance(result, (list, tuple)) and len(result) > 0:
            # Parse the tablature result
            tab_data = result[0]
            
            if isinstance(tab_data, str):
                # If it's a string, split into lines
                tablature = tab_data.split('\n')
            elif isinstance(tab_data, list):
                tablature = tab_data
            elif isinstance(tab_data, dict):
                tablature = tab_data.get('tablature', tab_data.get('tab', []))
            else:
                tablature = [str(tab_data)]
            
            return {
                "success": True,
                "tablature": tablature,
                "bpm": None,  # Extract if available in response
                "key": None,  # Extract if available in response
                "message": "Tablature generation completed successfully"
            }
        else:
            return {
                "success": False,
                "error": "Unexpected response format from tablature generation API",
                "raw_result": str(result)
            }
            
    except Exception as e:
        logger.error(f"Tablature generation error: {e}")
        # Clean up temp file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        raise HTTPException(status_code=500, detail=f"Tablature generation failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)