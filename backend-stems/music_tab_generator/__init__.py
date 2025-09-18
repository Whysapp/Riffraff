"""
Music tab generator wrapper for backend use.
This module provides a simple interface to generate tablature from audio files.
"""
import os
import numpy as np
import librosa
from pathlib import Path
from typing import Optional

def generate_tabs_for_file(input_wav: str, output_html: str, instrument: str = "guitar") -> None:
    """
    Generate tablature HTML file from an audio WAV file.
    
    Args:
        input_wav: Path to input WAV file
        output_html: Path to output HTML file
        instrument: Target instrument (default: "guitar")
    """
    try:
        # Load audio file
        y, sr = librosa.load(input_wav, sr=44100, mono=False)
        
        # Convert to mono if stereo
        if y.ndim > 1:
            y = np.mean(y, axis=0)
        
        # Basic pitch detection using librosa
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr, threshold=0.1, fmin=80, fmax=2000)
        
        # Extract dominant pitches over time
        times = librosa.frames_to_time(np.arange(pitches.shape[1]), sr=sr)
        frequencies = []
        
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:
                frequencies.append(pitch)
            else:
                frequencies.append(0)
        
        # Convert frequencies to guitar tablature
        tab_lines = generate_simple_tab(frequencies, times, instrument)
        
        # Generate HTML output
        html_content = generate_tab_html(tab_lines, instrument, input_wav)
        
        # Write to file
        Path(output_html).write_text(html_content, encoding='utf-8')
        
    except Exception as e:
        # Fallback: create error HTML
        error_html = f"""
        <html>
        <head><title>Tablature Generation Error</title></head>
        <body>
            <h2>Tablature Generation Failed</h2>
            <p>Error: {str(e)}</p>
            <p>Input file: {input_wav}</p>
            <p>Please check the audio file and try again.</p>
        </body>
        </html>
        """
        Path(output_html).write_text(error_html, encoding='utf-8')

def generate_simple_tab(frequencies: list, times: list, instrument: str = "guitar") -> list[str]:
    """
    Convert frequencies to simple tablature representation.
    """
    # Guitar tuning (standard): E A D G B E (from low to high)
    if instrument == "guitar":
        open_strings = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]  # Hz
        string_names = ['E', 'A', 'D', 'G', 'B', 'E']
    else:
        # Default to guitar
        open_strings = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]
        string_names = ['E', 'A', 'D', 'G', 'B', 'E']
    
    # Initialize tab lines
    tab_lines = [f"{name}|" for name in reversed(string_names)]  # High to low
    
    # Group frequencies into time segments
    segment_duration = 0.25  # seconds
    current_time = 0
    
    for i, freq in enumerate(frequencies):
        if i < len(times):
            time = times[i]
        else:
            time = current_time + segment_duration
            
        if time >= current_time + segment_duration:
            # Add segment to tab
            fret_pos = frequency_to_fret(freq, open_strings) if freq > 0 else None
            
            for j, line in enumerate(tab_lines):
                if fret_pos and j == (len(string_names) - 1 - fret_pos['string']):
                    tab_lines[j] += f"-{fret_pos['fret']}"
                else:
                    tab_lines[j] += "--"
            
            current_time += segment_duration
    
    # Close tab lines
    for i in range(len(tab_lines)):
        tab_lines[i] += "-|"
    
    return tab_lines

def frequency_to_fret(frequency: float, open_strings: list) -> Optional[dict]:
    """
    Convert frequency to fret position on guitar.
    """
    if frequency < 40 or not np.isfinite(frequency):
        return None
    
    best_match = None
    min_fret = float('inf')
    
    for string_idx, open_freq in enumerate(open_strings):
        # Calculate fret number using equal temperament
        fret = round(12 * np.log2(frequency / open_freq))
        
        if 0 <= fret <= 24 and fret < min_fret:  # Reasonable fret range
            min_fret = fret
            best_match = {'string': string_idx, 'fret': fret}
    
    return best_match

def generate_tab_html(tab_lines: list[str], instrument: str, audio_file: str) -> str:
    """
    Generate HTML representation of the tablature.
    """
    audio_filename = Path(audio_file).name
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Generated Tablature - {instrument.title()}</title>
        <style>
            body {{ 
                font-family: 'Courier New', monospace; 
                margin: 20px; 
                background-color: #f5f5f5; 
            }}
            .tab-container {{ 
                background: white; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            }}
            .tab-line {{ 
                font-size: 14px; 
                line-height: 1.2; 
                margin: 2px 0; 
                letter-spacing: 1px; 
            }}
            .header {{ 
                margin-bottom: 20px; 
                font-family: Arial, sans-serif; 
            }}
            .note {{ 
                color: #666; 
                font-size: 12px; 
                margin-top: 20px; 
                font-family: Arial, sans-serif; 
            }}
        </style>
    </head>
    <body>
        <div class="tab-container">
            <div class="header">
                <h2>🎸 Generated Tablature</h2>
                <p><strong>Instrument:</strong> {instrument.title()}</p>
                <p><strong>Source:</strong> {audio_filename}</p>
            </div>
            
            <div class="tablature">
    """
    
    for line in tab_lines:
        html += f'        <div class="tab-line">{line}</div>\n'
    
    html += """
            </div>
            
            <div class="note">
                <p><strong>Note:</strong> This tablature was auto-generated from audio analysis. 
                It may require manual adjustment for accuracy. Each number represents a fret position.</p>
                <p><strong>Reading:</strong> Each line represents a string (top = high E, bottom = low E for guitar).</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html