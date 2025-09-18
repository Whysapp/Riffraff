import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type ProcessRequest = {
  sourceId?: string;
  audioUrl?: string;
  audioFile?: File;
  instrumentKey: string;
};

export async function POST(request: Request) {
  try {
    // Handle both JSON and FormData requests
    let body: ProcessRequest;
    let audioFile: File | null = null;

    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (file upload)
      const formData = await request.formData();
      audioFile = formData.get('file') as File;
      const instrumentKey = formData.get('instrumentKey') as string;
      
      if (!instrumentKey) {
        return NextResponse.json({ error: 'instrumentKey is required' }, { status: 400 });
      }
      
      body = { instrumentKey };
    } else {
      // Handle JSON request
      body = (await request.json()) as ProcessRequest;
      if (!body.instrumentKey) {
        return NextResponse.json({ error: 'instrumentKey is required' }, { status: 400 });
      }
    }

    // If we have an audio file, use HuggingFace Guitar Tabs AI
    if (audioFile) {
      try {
        // Try direct HuggingFace Spaces API first
        const hfFormData = new FormData();
        hfFormData.append('file', audioFile);

        const hfResponse = await fetch('https://jonathanjh-guitar-tabs-ai.hf.space/api/predict', {
          method: 'POST',
          body: hfFormData,
          headers: {
            'Accept': 'application/json',
          },
        });

        if (hfResponse.ok) {
          const result = await hfResponse.json();
          
          // Process HuggingFace response
          if (result.data && Array.isArray(result.data)) {
            const tabData = result.data[0];
            
            let tablature: string[] = [];
            let bpm: number | null = null;
            let key: string | null = null;
            
            if (typeof tabData === 'string') {
              tablature = tabData.split('\n').filter(line => line.trim() !== '');
            } else if (Array.isArray(tabData)) {
              tablature = tabData;
            } else if (typeof tabData === 'object' && tabData !== null) {
              tablature = tabData.tablature || tabData.tab || [];
              bpm = tabData.bpm || tabData.tempo || null;
              key = tabData.key || null;
            }
            
            return NextResponse.json({
              ok: true,
              tablature,
              bpm: bpm || 120,
              key: key || 'Unknown',
              source: 'huggingface'
            });
          }
        }
      } catch (hfError) {
        console.warn('HuggingFace direct API failed, trying proxy:', hfError);
      }

      // Fallback to proxy service
      try {
        const proxyUrl = process.env.HF_PROXY_URL || 'http://localhost:8001';
        const proxyFormData = new FormData();
        proxyFormData.append('file', audioFile);

        const proxyResponse = await fetch(`${proxyUrl}/generate-tablature`, {
          method: 'POST',
          body: proxyFormData,
        });

        if (proxyResponse.ok) {
          const result = await proxyResponse.json();
          
          if (result.success) {
            return NextResponse.json({
              ok: true,
              tablature: result.tablature,
              bpm: result.bpm || 120,
              key: result.key || 'Unknown',
              source: 'proxy'
            });
          }
        }
      } catch (proxyError) {
        console.warn('Proxy API failed:', proxyError);
      }
    }

    // Fallback to original mock response
    const tablature = [
      'E|–3–2–0–2–3–3–3–2–0–2–0–2–0–|',
      'B|–0–3–0–0–0–0–0–3–0–0–3–3–3–|',
      'G|–0–2–0–0–0–0–0–2–0–0–2–2–2–|',
      'D|–0–0–2–0–2–0–2–0–2–2–0–0–0–|',
      'A|–2–x–2–2–2–2–2–x–2–2–x–x–x–|',
      'E|–3–x–0–2–x–3–x–x–0–2–x–x–x–|',
    ];
    
    return NextResponse.json({ 
      ok: true, 
      tablature, 
      bpm: 120, 
      key: 'G Major',
      source: 'fallback'
    });
    
  } catch (error) {
    console.error('Tablature generation error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

