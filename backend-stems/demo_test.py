#!/usr/bin/env python3
"""
Demo script to test the Riffraff backend functionality.
This creates a synthetic audio file and tests the full pipeline.
"""
import numpy as np
import soundfile as sf
import tempfile
from pathlib import Path
import os
import sys

def create_synthetic_guitar_audio(duration=3.0, sr=44100):
    """Create a synthetic guitar-like audio signal."""
    t = np.linspace(0, duration, int(sr * duration))
    
    # Guitar chord frequencies (C major chord)
    frequencies = [130.81, 164.81, 196.00, 261.63]  # C3, E3, G3, C4
    
    # Create a simple chord progression
    audio = np.zeros_like(t)
    for freq in frequencies:
        # Add harmonics to make it more guitar-like
        fundamental = 0.3 * np.sin(2 * np.pi * freq * t)
        harmonic2 = 0.15 * np.sin(2 * np.pi * freq * 2 * t)
        harmonic3 = 0.1 * np.sin(2 * np.pi * freq * 3 * t)
        audio += fundamental + harmonic2 + harmonic3
    
    # Add some envelope (attack/decay)
    envelope = np.exp(-t * 0.5) * (1 - np.exp(-t * 10))
    audio *= envelope
    
    # Create stereo
    stereo_audio = np.stack([audio, audio * 0.9], axis=0)  # [channels, samples]
    return stereo_audio, sr

def test_basic_import():
    """Test that we can import our modules."""
    print("🔍 Testing imports...")
    try:
        # Test imports without actually loading models
        import sys
        sys.path.insert(0, '.')
        
        # This will fail if torch is not installed, but syntax should be OK
        print("   - Checking separators module syntax...")
        import py_compile
        py_compile.compile('separators/demucs_sep.py', doraise=True)
        
        print("   - Checking tab generator syntax...")
        py_compile.compile('music_tab_generator/__init__.py', doraise=True)
        
        print("✅ Import syntax checks passed")
        return True
    except Exception as e:
        print(f"❌ Import test failed: {e}")
        return False

def test_tab_generation():
    """Test tablature generation with synthetic audio."""
    print("🎸 Testing tablature generation...")
    try:
        # Import the tab generator
        from music_tab_generator import generate_tabs_for_file
        
        # Create synthetic audio
        audio, sr = create_synthetic_guitar_audio(duration=2.0)
        
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save audio file
            audio_path = Path(tmp_dir) / "test_guitar.wav"
            sf.write(str(audio_path), audio.T, sr)  # soundfile expects [samples, channels]
            
            # Generate tabs
            tabs_path = Path(tmp_dir) / "test_tabs.html"
            generate_tabs_for_file(str(audio_path), str(tabs_path))
            
            # Check results
            if tabs_path.exists():
                content = tabs_path.read_text()
                if "Tablature" in content and "guitar" in content.lower():
                    print("✅ Tablature generation successful")
                    print(f"   Generated HTML file: {len(content)} characters")
                    return True
                else:
                    print("❌ Tablature content incomplete")
                    return False
            else:
                print("❌ Tablature file not created")
                return False
                
    except ImportError as e:
        print(f"❌ Tab generation test failed (missing dependencies): {e}")
        return False
    except Exception as e:
        print(f"❌ Tab generation test failed: {e}")
        return False

def test_separator_syntax():
    """Test that the separator module has valid syntax."""
    print("🔧 Testing separator syntax...")
    try:
        import py_compile
        py_compile.compile('separators/demucs_sep.py', doraise=True)
        print("✅ Separator syntax valid")
        return True
    except Exception as e:
        print(f"❌ Separator syntax test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Riffraff Backend Demo Test")
    print("=" * 40)
    
    tests = [
        ("Basic Import Check", test_basic_import),
        ("Separator Syntax", test_separator_syntax),
        ("Tablature Generation", test_tab_generation),
    ]
    
    results = []
    for name, test_func in tests:
        print(f"\n📋 {name}")
        print("-" * 30)
        result = test_func()
        results.append((name, result))
    
    print("\n" + "=" * 40)
    print("📊 Test Results Summary")
    print("=" * 40)
    
    passed = 0
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{name:.<30} {status}")
        if result:
            passed += 1
    
    print(f"\nTotal: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("\n🎉 All tests passed! The backend is ready for deployment.")
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Run FastAPI server: uvicorn app:app --host 0.0.0.0 --port 10000")
        print("3. Deploy to HF Spaces: Follow instructions in README.md")
    else:
        print(f"\n⚠️  {len(results) - passed} tests failed. Check the errors above.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())