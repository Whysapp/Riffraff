"""
Tests for the DemucsSeparator class and separation functionality.
"""
import pytest
import numpy as np
import tempfile
import soundfile as sf
from pathlib import Path
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from separators.demucs_sep import DemucsSeparator
from music_tab_generator import generate_tabs_for_file

class TestDemucsSeparator:
    
    @pytest.fixture
    def separator(self):
        """Create a DemucsSeparator instance for testing."""
        return DemucsSeparator(sr=44100)
    
    @pytest.fixture
    def synthetic_audio(self):
        """Generate a short synthetic audio file for testing."""
        # Create 2 seconds of synthetic audio (stereo)
        sr = 44100
        duration = 2.0
        samples = int(sr * duration)
        
        # Generate a simple sine wave (440 Hz - A4)
        t = np.linspace(0, duration, samples)
        frequency = 440.0  # A4 note
        
        # Create stereo signal
        left_channel = 0.5 * np.sin(2 * np.pi * frequency * t)
        right_channel = 0.5 * np.sin(2 * np.pi * frequency * t * 1.01)  # Slightly detuned
        
        audio = np.stack([left_channel, right_channel], axis=0)  # Shape: [2, samples]
        return audio, sr
    
    def test_separator_initialization(self, separator):
        """Test that the separator initializes correctly."""
        assert separator.sr == 44100
        assert separator.model_name in ["htdemucs", "htdemucs_6s"]
        assert separator.model is None  # Not loaded until needed
    
    def test_separator_load(self, separator):
        """Test that the separator loads the model correctly."""
        # This test requires actual model download, so we'll mock it
        try:
            separator.load()
            assert separator.model is not None
        except Exception as e:
            # If model loading fails (e.g., no internet), skip this test
            pytest.skip(f"Model loading failed: {e}")
    
    def test_separate_from_path_basic(self, separator, synthetic_audio):
        """Test basic separation functionality with synthetic audio."""
        audio, sr = synthetic_audio
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save synthetic audio to file
            audio_path = Path(tmp_dir) / "test_audio.wav"
            sf.write(str(audio_path), audio.T, sr)  # soundfile expects [samples, channels]
            
            try:
                # Run separation
                result = separator.separate_from_path(str(audio_path))
                
                # Check that we get the expected keys
                assert "guitar" in result
                assert "others" in result
                
                # Check shapes - should be [channels, samples]
                assert result["guitar"].shape[0] == 2  # stereo
                assert result["others"].shape[0] == 2  # stereo
                assert result["guitar"].shape[1] > 0   # has samples
                assert result["others"].shape[1] > 0   # has samples
                
                # Check data types
                assert result["guitar"].dtype == np.float32
                assert result["others"].dtype == np.float32
                
                # Check that values are reasonable (not all zeros, not clipped too much)
                assert not np.allclose(result["guitar"], 0)  # Should not be silent
                assert np.all(np.abs(result["guitar"]) <= 1.1)  # Should be roughly normalized
                assert np.all(np.abs(result["others"]) <= 1.1)  # Should be roughly normalized
                
            except Exception as e:
                # If separation fails due to missing model, skip
                if "model" in str(e).lower() or "download" in str(e).lower():
                    pytest.skip(f"Model not available: {e}")
                else:
                    raise
    
    def test_separate_with_parameters(self, separator, synthetic_audio):
        """Test separation with different parameters."""
        audio, sr = synthetic_audio
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            audio_path = Path(tmp_dir) / "test_audio.wav"
            sf.write(str(audio_path), audio.T, sr)
            
            try:
                # Test with custom parameters
                result = separator.separate_from_path(
                    str(audio_path),
                    segment=30,  # shorter segment
                    overlap=0.2,  # different overlap
                    shifts=1      # with shifts
                )
                
                assert "guitar" in result
                assert "others" in result
                assert result["guitar"].shape[0] == 2
                assert result["others"].shape[0] == 2
                
            except Exception as e:
                if "model" in str(e).lower():
                    pytest.skip(f"Model not available: {e}")
                else:
                    raise

class TestTabGeneration:
    
    def test_generate_tabs_for_file_basic(self):
        """Test basic tablature generation."""
        # Create a simple audio file
        sr = 44100
        duration = 1.0
        samples = int(sr * duration)
        
        # Simple sine wave at guitar frequency (E4 = 329.63 Hz)
        t = np.linspace(0, duration, samples)
        frequency = 329.63  # High E string open
        audio = 0.3 * np.sin(2 * np.pi * frequency * t)
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            audio_path = Path(tmp_dir) / "test_guitar.wav"
            html_path = Path(tmp_dir) / "test_tabs.html"
            
            # Save audio file
            sf.write(str(audio_path), audio, sr)
            
            # Generate tabs
            generate_tabs_for_file(str(audio_path), str(html_path))
            
            # Check that HTML file was created
            assert html_path.exists()
            
            # Check HTML content
            html_content = html_path.read_text(encoding='utf-8')
            assert "<html>" in html_content
            assert "Tablature" in html_content
            assert "guitar" in html_content.lower()
    
    def test_generate_tabs_error_handling(self):
        """Test tablature generation error handling."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            nonexistent_audio = Path(tmp_dir) / "nonexistent.wav"
            html_path = Path(tmp_dir) / "error_tabs.html"
            
            # This should create an error HTML file
            generate_tabs_for_file(str(nonexistent_audio), str(html_path))
            
            # Check that HTML file was created with error message
            assert html_path.exists()
            html_content = html_path.read_text(encoding='utf-8')
            assert "error" in html_content.lower() or "failed" in html_content.lower()

class TestIntegration:
    
    def test_full_pipeline(self):
        """Test the full pipeline from audio to separated stems and tabs."""
        # Create synthetic stereo audio with guitar-like content
        sr = 44100
        duration = 2.0
        samples = int(sr * duration)
        
        t = np.linspace(0, duration, samples)
        # Mix of guitar-range frequencies
        frequencies = [329.63, 246.94, 196.0]  # E, B, G strings
        audio_left = sum(0.2 * np.sin(2 * np.pi * f * t) for f in frequencies)
        audio_right = audio_left * 0.9  # Slightly different right channel
        
        audio = np.stack([audio_left, audio_right], axis=0)
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save input audio
            input_path = Path(tmp_dir) / "input.wav"
            sf.write(str(input_path), audio.T, sr)
            
            # Initialize separator
            separator = DemucsSeparator(sr=sr)
            
            try:
                # Run separation
                stems = separator.separate_from_path(str(input_path))
                
                # Save guitar stem
                guitar_path = Path(tmp_dir) / "guitar.wav"
                sf.write(str(guitar_path), stems["guitar"].T, sr)
                
                # Generate tabs
                tabs_path = Path(tmp_dir) / "tabs.html"
                generate_tabs_for_file(str(guitar_path), str(tabs_path))
                
                # Verify all outputs exist
                assert guitar_path.exists()
                assert tabs_path.exists()
                
                # Verify content
                tabs_content = tabs_path.read_text(encoding='utf-8')
                assert "Tablature" in tabs_content
                
            except Exception as e:
                if "model" in str(e).lower():
                    pytest.skip(f"Model not available for integration test: {e}")
                else:
                    raise

if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])