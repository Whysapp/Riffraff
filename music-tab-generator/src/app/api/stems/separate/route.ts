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
    try {
      console.log('Attempting HuggingFace direct API call')
      const hfFormData = new FormData()
      hfFormData.append('file', file, (file as any).name ?? 'audio.wav')

      const hfResponse = await fetch('https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/api/predict', {
        method: 'POST',
        body: hfFormData,
        headers: {
          'Accept': 'application/json',
        },
      })

      console.log(`HuggingFace API response status: ${hfResponse.status}`)

      if (hfResponse.ok) {
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
          console.warn('Unexpected HuggingFace response format:', result)
        }
      } else {
        const errorText = await hfResponse.text()
        console.warn(`HuggingFace API failed with status ${hfResponse.status}:`, errorText)
      }
    } catch (hfError) {
      console.warn('HuggingFace direct API failed:', hfError)
    }

    // Fallback to proxy service
    const proxyUrl = process.env.HF_PROXY_URL || 'http://localhost:8001'
    console.log(`Trying proxy service at: ${proxyUrl}`)
    
    if (!proxyUrl || proxyUrl === '') {
      console.log('No proxy URL configured, skipping proxy attempt')
      return NextResponse.json({ 
        success: false,
        error: 'Stem separation service temporarily unavailable. Please try again later.',
        details: 'Both HuggingFace direct API and proxy service are unavailable.'
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

