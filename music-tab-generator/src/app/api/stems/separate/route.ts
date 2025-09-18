import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

// Increase body size limit for audio files
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    // Try direct HuggingFace Spaces API first
    try {
      const hfFormData = new FormData()
      hfFormData.append('file', file, (file as any).name ?? 'audio.wav')

      const hfResponse = await fetch('https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space/api/predict', {
        method: 'POST',
        body: hfFormData,
        headers: {
          'Accept': 'application/json',
        },
      })

      if (hfResponse.ok) {
        const result = await hfResponse.json()
        
        // Process HuggingFace response
        if (result.data && Array.isArray(result.data)) {
          const stemData = result.data[0]
          
          return NextResponse.json({
            success: true,
            stems: stemData,
            source: 'huggingface',
          })
        }
      }
    } catch (hfError) {
      console.warn('HuggingFace direct API failed, trying proxy:', hfError)
    }

    // Fallback to proxy service
    const proxyUrl = process.env.HF_PROXY_URL || 'http://localhost:8001'
    const proxyFormData = new FormData()
    proxyFormData.append('file', file, (file as any).name ?? 'audio.wav')

    const proxyResponse = await fetch(`${proxyUrl}/separate-stems`, {
      method: 'POST',
      body: proxyFormData,
    })

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text()
      return NextResponse.json({ 
        error: 'Stem separation failed', 
        details: errorText 
      }, { status: proxyResponse.status })
    }

    const result = await proxyResponse.json()
    return NextResponse.json({
      ...result,
      source: 'proxy',
    })

  } catch (err: any) {
    console.error('Stem separation error:', err)
    return NextResponse.json({ 
      error: 'Stem separation failed', 
      details: String(err?.message ?? err) 
    }, { status: 500 })
  }
}

