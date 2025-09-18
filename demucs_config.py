"""
Advanced Demucs Configuration for Fine-tuning Audio Quality

This module provides advanced configuration options for improving Demucs audio separation quality.
You can adjust these parameters based on your specific needs and available computational resources.
"""

import os
from typing import Dict, Any

class DemucsConfig:
    """Configuration class for Demucs audio separation parameters"""
    
    # Model Selection
    # Available models (in order of quality vs speed):
    # - htdemucs_ft: Fine-tuned version, best quality but slower
    # - htdemucs: Standard hybrid transformer model
    # - htdemucs_quantized: Faster but lower quality (original default)
    # - htdemucs_6s: 6-source separation (drums, bass, other, vocals, guitar, piano)
    # - mdx_extra_q: Alternative model architecture
    MODEL_OPTIONS = {
        "best_quality": "htdemucs_ft",
        "balanced": "htdemucs", 
        "fast": "htdemucs_quantized",
        "six_source": "htdemucs_6s",
        "alternative": "mdx_extra_q"
    }
    
    # Processing Parameters for Quality Optimization
    QUALITY_PRESETS = {
        "maximum": {
            "overlap": 0.75,  # Maximum overlap for smoothest transitions
            "shifts": 4,      # Multiple predictions for best averaging
            "split": True,    # Enable chunked processing
            "use_float32": True,
            "segment_length": None,  # Use full length when possible
        },
        "high": {
            "overlap": 0.25,  # Good balance of quality and speed
            "shifts": 2,      # Two shifts for improved quality
            "split": True,
            "use_float32": True,
            "segment_length": None,
        },
        "balanced": {
            "overlap": 0.15,
            "shifts": 1,
            "split": True,
            "use_float32": False,
            "segment_length": 10,  # 10 second segments
        },
        "fast": {
            "overlap": 0.10,
            "shifts": 0,
            "split": True,
            "use_float32": False,
            "segment_length": 8,
        }
    }
    
    # Audio Processing Settings
    AUDIO_SETTINGS = {
        "target_sample_rate": 44100,  # Standard CD quality
        "target_channels": 2,         # Stereo output
        "normalization_method": "rms", # "rms" or "zscore"
        "soft_clipping": True,        # Reduces harsh artifacts
        "output_format": "float32",   # "float32", "int24", or "int16"
    }
    
    @classmethod
    def get_config(cls, quality_preset: str = "high", model_preset: str = "best_quality") -> Dict[str, Any]:
        """
        Get a complete configuration dictionary
        
        Args:
            quality_preset: One of "maximum", "high", "balanced", "fast"
            model_preset: One of "best_quality", "balanced", "fast", "six_source", "alternative"
            
        Returns:
            Dictionary with all configuration parameters
        """
        config = {
            "model_name": cls.MODEL_OPTIONS.get(model_preset, "htdemucs_ft"),
            **cls.QUALITY_PRESETS.get(quality_preset, cls.QUALITY_PRESETS["high"]),
            **cls.AUDIO_SETTINGS
        }
        
        # Override with environment variables if set
        config["model_name"] = os.environ.get("DEMUCS_MODEL", config["model_name"])
        config["use_float32"] = os.environ.get("USE_FLOAT32", str(config["use_float32"])).lower() == "true"
        config["overlap"] = float(os.environ.get("DEMUCS_OVERLAP", config["overlap"]))
        config["shifts"] = int(os.environ.get("DEMUCS_SHIFTS", config["shifts"]))
        
        return config
    
    @classmethod
    def get_model_info(cls) -> Dict[str, str]:
        """Get information about available models"""
        return {
            "htdemucs_ft": "Fine-tuned Hybrid Transformer - Best quality, slower processing",
            "htdemucs": "Standard Hybrid Transformer - Good balance of quality and speed", 
            "htdemucs_quantized": "Quantized model - Faster but lower quality",
            "htdemucs_6s": "6-source separation - Includes guitar and piano stems",
            "mdx_extra_q": "Alternative architecture - Different sound characteristics"
        }

# Example usage configurations
PRODUCTION_CONFIG = DemucsConfig.get_config("high", "best_quality")
DEVELOPMENT_CONFIG = DemucsConfig.get_config("balanced", "balanced")
FAST_CONFIG = DemucsConfig.get_config("fast", "fast")

# For users who want maximum quality regardless of processing time
AUDIOPHILE_CONFIG = DemucsConfig.get_config("maximum", "best_quality")

# For music producers who need guitar and piano stems
PRODUCER_CONFIG = DemucsConfig.get_config("high", "six_source")