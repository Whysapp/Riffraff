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
      const hfFormData = new FormData()
      hfFormData.append('file', file, (file as any).name ?? 'audio.wav')

      // Try different possible Gradio API endpoints
      const possibleEndpoints = [
        'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/run/predict',
        'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/api/predict',
        'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/call/predict',
      ];

      let hfResponse: Response | null = null;

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          hfResponse = await fetch(endpoint, {
            method: 'POST',
            body: hfFormData,
            headers: {
              'Accept': 'application/json',
            },
          });
          
          console.log(`Endpoint ${endpoint} responded with status: ${hfResponse.status}`);
          
          if (hfResponse.ok) {
            break; // Success, exit the loop
          } else {
            const errorText = await hfResponse.text();
            lastError = `${hfResponse.status}: ${errorText}`;
            console.warn(`Endpoint ${endpoint} failed: ${lastError}`);
          }
        } catch (error) {
          lastError = String(error);
          console.warn(`Endpoint ${endpoint} error:`, error);
        }
      }

      if (hfResponse && hfResponse.ok) {
        const result = await hfResponse.json()
        console.log('HuggingFace API response:', JSON.stringify(result, null, 2))
        
        // Process HuggingFace response
        if (result.data && Array.isArray(result.data)) {
          const stemData = result.data[0]
          
          return NextResponse.json({
            success: true,
            stems: stemData,
            source: 'huggingface',
          })
        } else {
          lastError = 'Unexpected response format from HuggingFace API';
          console.warn('Unexpected HuggingFace response format:', result)
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

