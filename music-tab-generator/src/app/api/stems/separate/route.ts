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
      
      // Try multiple endpoint formats that Gradio commonly uses
      const possibleEndpoints = [
        'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/api/predict',
        'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/run/separate_selected_models',
        'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/call/separate_selected_models'
      ];

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          
          // Try FormData approach first
          const formData = new FormData();
          formData.append('data', JSON.stringify([
            file,  // audio_path
            true,  // run_htdemucs
            true   // run_spleeter
          ]));
          
          let hfResponse = await fetch(endpoint, {
            method: 'POST',
            body: formData,
          });
          
          console.log(`FormData attempt - Status: ${hfResponse.status}`);
          
          // If FormData fails, try JSON approach
          if (!hfResponse.ok) {
            console.log('FormData failed, trying JSON approach');
            
            const fileArrayBuffer = await file.arrayBuffer();
            const fileBase64 = Buffer.from(fileArrayBuffer).toString('base64');
            const fileName = (file as any).name || 'audio.wav';
            
            const payload = {
              data: [
                {
                  name: fileName,
                  data: `data:${file.type};base64,${fileBase64}`
                },
                true, // run_htdemucs
                true  // run_spleeter
              ]
            };
            
            hfResponse = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });
            
            console.log(`JSON attempt - Status: ${hfResponse.status}`);
          }
          
          if (hfResponse.ok) {
            const result = await hfResponse.json()
            console.log('HuggingFace API response:', JSON.stringify(result, null, 2))
            
            // Process response - try different possible formats
            let stems = null;
            
            if (result.data && Array.isArray(result.data) && result.data.length >= 4) {
              // Format from documentation: 10 elements
              stems = {
                drums: result.data[0]?.url || result.data[5]?.url || '',
                bass: result.data[1]?.url || result.data[6]?.url || '',
                other: result.data[2]?.url || result.data[7]?.url || '',
                vocals: result.data[3]?.url || result.data[4]?.url || '',
              };
            } else if (result && typeof result === 'object') {
              // Try direct object format
              stems = {
                drums: result.drums?.url || result.drums || '',
                bass: result.bass?.url || result.bass || '',
                other: result.other?.url || result.other || '',
                vocals: result.vocals?.url || result.vocals || '',
              };
            }
            
            if (stems && Object.values(stems).some(url => url)) {
              return NextResponse.json({
                success: true,
                stems: stems,
                source: 'huggingface',
                status: result.data?.[9] || result.status || 'Completed',
              })
            } else {
              lastError = `Unexpected response format from ${endpoint}`;
              console.warn('Unexpected response format:', result)
            }
          } else {
            const errorText = await hfResponse.text();
            lastError = `${hfResponse.status}: ${errorText}`;
            console.warn(`Endpoint ${endpoint} failed: ${lastError}`);
          }
        } catch (endpointError) {
          lastError = String(endpointError);
          console.warn(`Endpoint ${endpoint} error:`, endpointError);
        }
      }
      
      console.warn('All HuggingFace endpoints failed');
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

