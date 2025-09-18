import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    console.log('Stem separation request received')
    const formData = await request.formData()
    const file = formData.get('file')
    
    if (!file || !(file instanceof Blob)) {
      console.error('No file provided in request')
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    console.log(`Processing file: ${(file as any).name}, size: ${file.size} bytes`)

    // Try direct HuggingFace Spaces API first
    let lastError: string = '';
    
    try {
      console.log('Attempting HuggingFace direct API call')
      
      // Use the correct Gradio API endpoint from the config
      const baseUrl = 'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space';
      const endpoint = `${baseUrl}/gradio_api/run/separate_selected_models`;

      console.log(`Calling endpoint: ${endpoint}`);
      
      // First upload the file to get a temporary URL
      const uploadFormData = new FormData();
      uploadFormData.append('files', file, (file as any).name || 'audio.wav');
      
      const uploadResponse = await fetch(`${baseUrl}/gradio_api/upload`, {
        method: 'POST',
        body: uploadFormData,
      });
      
      console.log(`Upload response status: ${uploadResponse.status}`);
      
      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        lastError = `Upload failed: ${uploadResponse.status} ${uploadError}`;
        console.warn('File upload failed:', lastError);
      } else {
        const uploadResult = await uploadResponse.json();
        console.log('Upload result:', JSON.stringify(uploadResult, null, 2));
        
        // Get the uploaded file path/URL
        const filePath = uploadResult[0]?.name || uploadResult[0] || uploadResult;
        
        // Now call the separation function with the uploaded file
        const payload = {
          data: [
            filePath,  // audio_path - use the uploaded file path
            true,      // run_htdemucs
            true       // run_spleeter
          ],
          event_data: null,
          fn_index: 0  // From the dependencies array
        };
        
        const hfResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        console.log(`Separation API response status: ${hfResponse.status}`);
        
        if (hfResponse.ok) {
          const result = await hfResponse.json()
          console.log('HuggingFace API response:', JSON.stringify(result, null, 2))
          
          // Process response according to documentation
          // Returns list of 10 elements: [drums, bass, other, vocals, vocals, drums, bass, other, piano, status]
          if (result.data && Array.isArray(result.data) && result.data.length >= 4) {
            const stems = {
              drums: result.data[0]?.url || result.data[5]?.url || '',
              bass: result.data[1]?.url || result.data[6]?.url || '',
              other: result.data[2]?.url || result.data[7]?.url || '',
              vocals: result.data[3]?.url || result.data[4]?.url || '',
            };
            
            return NextResponse.json({
              success: true,
              stems: stems,
              source: 'huggingface',
              status: result.data[9] || 'Completed',
            })
          } else {
            lastError = 'Unexpected response format from HuggingFace API';
            console.warn('Unexpected response format:', result)
          }
        } else {
          const errorText = await hfResponse.text();
          lastError = `${hfResponse.status}: ${errorText}`;
          console.warn(`HuggingFace API failed: ${lastError}`);
        }
      }
    } catch (hfError) {
      lastError = String(hfError);
      console.warn('HuggingFace direct API failed:', hfError)
    }

    // Fallback to proxy service
    const proxyUrl = process.env.HF_PROXY_URL
    console.log(`Proxy URL configured: ${proxyUrl || 'none'}`)
    
    if (!proxyUrl || proxyUrl === '' || proxyUrl.includes('localhost')) {
      console.log('No valid proxy URL configured, skipping proxy attempt')
      return NextResponse.json({ 
        success: false,
        error: 'Stem separation service temporarily unavailable. Please try again later.',
        details: `HuggingFace API failed with: ${lastError}. No backup service available.`
      }, { status: 503 })
    }

    try {
      const proxyFormData = new FormData()
      proxyFormData.append('file', file, (file as any).name ?? 'audio.wav')

      const proxyResponse = await fetch(`${proxyUrl}/separate-stems`, {
        method: 'POST',
        body: proxyFormData,
      })

      console.log(`Proxy response status: ${proxyResponse.status}`)

      if (!proxyResponse.ok) {
        const errorText = await proxyResponse.text()
        console.error('Proxy error:', errorText)
        return NextResponse.json({ 
          success: false,
          error: 'Stem separation failed', 
          details: errorText 
        }, { status: proxyResponse.status })
      }

      const result = await proxyResponse.json()
      return NextResponse.json({
        ...result,
        source: 'proxy',
      })
    } catch (proxyError) {
      console.error('Proxy service error:', proxyError)
      return NextResponse.json({ 
        success: false,
        error: 'Stem separation service temporarily unavailable',
        details: 'Unable to connect to processing service'
      }, { status: 503 })
    }

  } catch (err: any) {
    console.error('Stem separation error:', err)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error during stem separation', 
      details: String(err?.message ?? err) 
    }, { status: 500 })
  }
}

