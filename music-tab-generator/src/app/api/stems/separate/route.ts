import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15 // Very short timeout, just start job and return immediately

export async function POST(request: NextRequest) {
  try {
    console.log('Stem separation request received')
    const formData = await request.formData()
    const file = formData.get('file')
    
    if (!file || !(file instanceof Blob)) {
      console.error('No file provided in request')
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`Processing file: ${(file as any).name}, size: ${fileSizeMB.toFixed(2)}MB`)

    // Warn about large files but still try
    if (fileSizeMB > 25) {
      return NextResponse.json({
        success: false,
        error: 'File too large',
        message: 'Please use a file under 25MB for stem separation.',
        source: 'validation'
      }, { status: 413 });
    }

    const baseUrl = 'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space';
    
    try {
      console.log('Starting HuggingFace job - quick start only')
      
      // Step 1: Upload the file with short timeout
      const uploadFormData = new FormData();
      uploadFormData.append('files', file, (file as any).name || 'audio.wav');
      
      const uploadController = new AbortController();
      const uploadTimeout = setTimeout(() => uploadController.abort(), 8000); // 8 second timeout
      
      const uploadResponse = await fetch(`${baseUrl}/gradio_api/upload`, {
        method: 'POST',
        body: uploadFormData,
        signal: uploadController.signal,
      });
      
      clearTimeout(uploadTimeout);
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      const uploadResult = await uploadResponse.json();
      const fileInfo = uploadResult[0];
      
      // Step 2: Join the queue quickly
      const sessionHash = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const queuePayload = {
        data: [fileInfo, true, true],
        event_data: null,
        fn_index: 0,
        trigger_id: 10,
        session_hash: sessionHash
      };
      
      const queueController = new AbortController();
      const queueTimeout = setTimeout(() => queueController.abort(), 5000); // 5 second timeout
      
      const queueResponse = await fetch(`${baseUrl}/gradio_api/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queuePayload),
        signal: queueController.signal,
      });
      
      clearTimeout(queueTimeout);
      
      if (!queueResponse.ok) {
        throw new Error(`Queue join failed: ${queueResponse.status}`);
      }
      
      const queueResult = await queueResponse.json();
      const eventId = queueResult.event_id;
      
      if (!eventId) {
        throw new Error('No event_id received');
      }
      
      console.log(`Job started successfully: ${eventId}`);
      
      // Return job info for client-side polling
      return NextResponse.json({
        success: true,
        jobId: eventId,
        sessionHash: sessionHash,
        status: 'started',
        message: 'Stem separation started successfully',
        source: 'huggingface'
      });
      
    } catch (hfError) {
      console.warn('HuggingFace job start failed:', hfError);
      
      // Return error but don't redirect
      return NextResponse.json({ 
        success: false,
        error: 'Failed to start stem separation',
        message: 'The AI service is currently busy. Please try again in a moment.',
        details: String(hfError),
        source: 'huggingface'
      }, { status: 503 });
    }

  } catch (err: any) {
    console.error('Stem separation error:', err)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error', 
      details: String(err?.message ?? err) 
    }, { status: 500 })
  }
}

