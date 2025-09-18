import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30 // Reduced to avoid timeout, will start job and return immediately

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

    // For files that will take too long, start the job and return a job ID for polling
    const baseUrl = 'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space';
    
    try {
      console.log('Starting HuggingFace job')
      
      // Step 1: Upload the file
      const uploadFormData = new FormData();
      uploadFormData.append('files', file, (file as any).name || 'audio.wav');
      
      const uploadResponse = await fetch(`${baseUrl}/gradio_api/upload`, {
        method: 'POST',
        body: uploadFormData,
      });
      
      console.log(`Upload response status: ${uploadResponse.status}`);
      
      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        console.warn('File upload failed:', uploadError);
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      const uploadResult = await uploadResponse.json();
      console.log('Upload result:', JSON.stringify(uploadResult, null, 2));
      
      // Get the uploaded file info
      const fileInfo = uploadResult[0];
      
      // Step 2: Join the queue
      const sessionHash = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const queuePayload = {
        data: [
          fileInfo,  // uploaded file info
          true,      // run_htdemucs
          true       // run_spleeter
        ],
        event_data: null,
        fn_index: 0,
        trigger_id: 10,
        session_hash: sessionHash
      };
      
      const queueResponse = await fetch(`${baseUrl}/gradio_api/queue/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queuePayload),
      });
      
      console.log(`Queue join response status: ${queueResponse.status}`);
      
      if (!queueResponse.ok) {
        const queueError = await queueResponse.text();
        console.warn('Queue join failed:', queueError);
        throw new Error(`Queue join failed: ${queueResponse.status}`);
      }
      
      const queueResult = await queueResponse.json();
      console.log('Queue result:', JSON.stringify(queueResult, null, 2));
      
      const eventId = queueResult.event_id;
      
      if (!eventId) {
        throw new Error('No event_id received from queue');
      }
      
      // Return job info immediately to avoid timeout
      return NextResponse.json({
        success: true,
        jobId: eventId,
        sessionHash: sessionHash,
        status: 'processing',
        message: 'Stem separation job started. Use the status endpoint to check progress.',
        pollUrl: `/api/stems/status?jobId=${eventId}&sessionHash=${sessionHash}`,
        source: 'huggingface'
      });
      
    } catch (hfError) {
      console.warn('HuggingFace API failed:', hfError);
      
      // Return error immediately
      return NextResponse.json({ 
        success: false,
        error: 'Failed to start stem separation job',
        details: String(hfError),
        source: 'huggingface'
      }, { status: 500 });
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

