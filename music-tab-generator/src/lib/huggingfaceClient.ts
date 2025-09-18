/**
 * HuggingFace Spaces API Client
 * Provides functions to interact with HuggingFace Spaces APIs
 */

export interface StemSeparationResult {
  stems: {
    drums: string;
    bass: string;
    other: string;
    vocals: string;
  };
  success: boolean;
  error?: string;
}

export interface TablatureResult {
  tablature: string[];
  bpm?: number;
  key?: string;
  success: boolean;
  error?: string;
}

/**
 * Call the HuggingFace Spleeter-HT-Demucs Stem Separation API
 */
export async function separateStems(audioFile: File): Promise<StemSeparationResult> {
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    
    // Using the HuggingFace Spaces API endpoint
    const response = await fetch('https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/api/predict', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // The response format may vary, so we need to handle different possible formats
    if (result.data && Array.isArray(result.data)) {
      // Gradio typically returns results in a data array
      const stemFiles = result.data[0]; // Assuming the first element contains the stem files
      
      return {
        stems: {
          drums: stemFiles.drums || '',
          bass: stemFiles.bass || '',
          other: stemFiles.other || '',
          vocals: stemFiles.vocals || '',
        },
        success: true,
      };
    } else {
      throw new Error('Unexpected response format from stem separation API');
    }
  } catch (error) {
    console.error('Stem separation error:', error);
    return {
      stems: { drums: '', bass: '', other: '', vocals: '' },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Call the HuggingFace Guitar Tabs AI API
 */
export async function generateTablature(audioFile: File): Promise<TablatureResult> {
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    
    // Using the HuggingFace Spaces API endpoint
    const response = await fetch('https://jonathanjh-guitar-tabs-ai.hf.space/api/predict', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // The response format may vary, so we need to handle different possible formats
    if (result.data && Array.isArray(result.data)) {
      // Gradio typically returns results in a data array
      const tabData = result.data[0];
      
      // Parse the tablature data - this may need adjustment based on actual API response
      let tablature: string[] = [];
      let bpm: number | undefined;
      let key: string | undefined;
      
      if (typeof tabData === 'string') {
        // If it's a string, split into lines
        tablature = tabData.split('\n').filter(line => line.trim() !== '');
      } else if (Array.isArray(tabData)) {
        tablature = tabData;
      } else if (typeof tabData === 'object') {
        tablature = tabData.tablature || tabData.tab || [];
        bpm = tabData.bpm || tabData.tempo;
        key = tabData.key;
      }
      
      return {
        tablature,
        bpm,
        key,
        success: true,
      };
    } else {
      throw new Error('Unexpected response format from tablature generation API');
    }
  } catch (error) {
    console.error('Tablature generation error:', error);
    return {
      tablature: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Alternative implementation using gradio_client approach
 * This would require a backend proxy since gradio_client is a Python library
 */
export async function separateStemsViaProxy(audioFile: File): Promise<StemSeparationResult> {
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    
    // Call our backend proxy that uses gradio_client
    const response = await fetch('/api/stems/separate-hf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Stem separation proxy error:', error);
    return {
      stems: { drums: '', bass: '', other: '', vocals: '' },
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function generateTablatureViaProxy(audioFile: File): Promise<TablatureResult> {
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    
    // Call our backend proxy that uses gradio_client
    const response = await fetch('/api/process-audio-hf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Tablature generation proxy error:', error);
    return {
      tablature: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}