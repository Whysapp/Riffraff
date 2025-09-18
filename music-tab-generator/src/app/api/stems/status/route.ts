import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const sessionHash = searchParams.get('sessionHash')
    
    if (!jobId || !sessionHash) {
      return NextResponse.json({ 
        error: 'Missing jobId or sessionHash parameters' 
      }, { status: 400 })
    }

    console.log(`Checking status for job: ${jobId}, session: ${sessionHash}`)

    const baseUrl = 'https://ahk-d-spleeter-ht-demucs-stem-separation-2025.hf.space';
    
    try {
      // Use Server-Sent Events to get real-time status
      const sseUrl = `${baseUrl}/gradio_api/queue/data?session_hash=${sessionHash}`;
      console.log(`Checking SSE status at: ${sseUrl}`);
      
      const sseResponse = await fetch(sseUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
      });
      
      console.log(`SSE response status: ${sseResponse.status}`);
      
      if (sseResponse.ok) {
        const sseText = await sseResponse.text();
        console.log(`SSE response (first 500 chars):`, sseText.substring(0, 500));
        
        // Parse Server-Sent Events format
        const lines = sseText.split('\n');
        let latestStatus = null;
        let queuePosition = null;
        let estimatedTime = null;
        let isProcessing = false;
        let hasCompleted = false;
        let completedData = null;
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6));
              console.log(`SSE event:`, eventData);
              
              if (eventData.msg === 'process_completed' && eventData.output) {
                // Job completed successfully
                hasCompleted = true;
                completedData = eventData.output.data;
                
              } else if (eventData.msg === 'process_starts') {
                isProcessing = true;
                latestStatus = 'Processing started...';
                
              } else if (eventData.msg === 'estimation') {
                queuePosition = eventData.rank;
                estimatedTime = eventData.queue_eta;
                latestStatus = `Queue position: ${queuePosition}, estimated: ${estimatedTime}s`;
                
              } else if (eventData.msg === 'progress') {
                latestStatus = `Processing: ${eventData.progress || 'In progress'}`;
                
              } else if (eventData.msg === 'error') {
                return NextResponse.json({
                  success: false,
                  status: 'failed',
                  error: eventData.output || 'Processing error occurred',
                  source: 'huggingface'
                });
                
              } else if (eventData.msg === 'unexpected_error' && eventData.session_not_found) {
                // Session expired - this is common with long-running jobs
                console.log('Session expired, but this is normal for long-running jobs');
                return NextResponse.json({
                  success: false,
                  status: 'session_expired',
                  error: 'Processing session expired. This happens with long-running jobs.',
                  message: 'The job may have completed, but the session expired. Please try again with a smaller file for faster processing.',
                  source: 'huggingface'
                });
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              console.warn('Failed to parse SSE line:', line);
            }
          }
        }
        
        // Return results based on what we found
        if (hasCompleted && completedData) {
          // Extract stems from completed data
          if (Array.isArray(completedData) && completedData.length >= 4) {
            const stems = {
              drums: completedData[0]?.url || completedData[5]?.url || '',
              bass: completedData[1]?.url || completedData[6]?.url || '',
              other: completedData[2]?.url || completedData[7]?.url || '',
              vocals: completedData[3]?.url || completedData[4]?.url || '',
            };
            
            console.log('Successfully extracted stems from SSE:', stems);
            
            return NextResponse.json({
              success: true,
              status: 'completed',
              stems: stems,
              source: 'huggingface',
              message: completedData[9] || 'Stem separation completed successfully'
            });
          }
        }
        
        // Return current processing status
        if (isProcessing) {
          return NextResponse.json({
            success: null,
            status: 'processing',
            message: latestStatus || 'Stem separation is currently processing...',
            source: 'huggingface'
          });
        } else if (queuePosition !== null) {
          return NextResponse.json({
            success: null,
            status: 'queued',
            queuePosition: queuePosition,
            estimatedTime: estimatedTime,
            message: latestStatus || `In queue position ${queuePosition}`,
            source: 'huggingface'
          });
        } else {
          // No specific status found, assume still processing
          return NextResponse.json({
            success: null,
            status: 'processing',
            message: 'Job is still processing. Please check again in a few seconds.',
            source: 'huggingface'
          });
        }
        
      } else {
        const errorText = await sseResponse.text();
        console.warn('SSE status check failed:', errorText);
        
        return NextResponse.json({
          success: false,
          status: 'error',
          error: 'Failed to check job status',
          details: errorText,
          source: 'huggingface'
        }, { status: sseResponse.status });
      }
      
    } catch (error) {
      console.error('Status check error:', error);
      
      return NextResponse.json({
        success: false,
        status: 'error',
        error: 'Failed to check job status',
        details: String(error),
        source: 'huggingface'
      }, { status: 500 });
    }

  } catch (err: any) {
    console.error('Status endpoint error:', err)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: String(err?.message ?? err) 
    }, { status: 500 })
  }
}