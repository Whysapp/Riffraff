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
      // Check queue status
      const statusResponse = await fetch(`${baseUrl}/gradio_api/queue/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          event_id: jobId,
          session_hash: sessionHash 
        }),
      });
      
      console.log(`Queue status response: ${statusResponse.status}`);
      
      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        console.log('Queue status result:', JSON.stringify(statusResult, null, 2));
        
        if (statusResult.success !== undefined) {
          if (statusResult.success && statusResult.data) {
            // Process successful result
            const data = statusResult.data;
            if (Array.isArray(data) && data.length >= 4) {
              const stems = {
                drums: data[0]?.url || data[5]?.url || '',
                bass: data[1]?.url || data[6]?.url || '',
                other: data[2]?.url || data[7]?.url || '',
                vocals: data[3]?.url || data[4]?.url || '',
              };
              
              console.log('Successfully extracted stems:', stems);
              
              return NextResponse.json({
                success: true,
                status: 'completed',
                stems: stems,
                source: 'huggingface',
                message: data[9] || 'Stem separation completed successfully'
              });
            }
          } else if (statusResult.success === false) {
            return NextResponse.json({
              success: false,
              status: 'failed',
              error: statusResult.error || 'Processing failed',
              source: 'huggingface'
            });
          }
        }
        
        // If no definitive result yet, check SSE stream
        const sseUrl = `${baseUrl}/gradio_api/queue/data?session_hash=${sessionHash}`;
        const sseResponse = await fetch(sseUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
          },
        });
        
        if (sseResponse.ok) {
          const sseText = await sseResponse.text();
          console.log(`SSE response (first 300 chars):`, sseText.substring(0, 300));
          
          // Parse SSE for status information
          const lines = sseText.split('\n');
          let queuePosition = null;
          let estimatedTime = null;
          let isProcessing = false;
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.msg === 'process_completed' && data.output) {
                  // Found completed result in SSE
                  const outputData = data.output.data;
                  if (Array.isArray(outputData) && outputData.length >= 4) {
                    const stems = {
                      drums: outputData[0]?.url || outputData[5]?.url || '',
                      bass: outputData[1]?.url || outputData[6]?.url || '',
                      other: outputData[2]?.url || outputData[7]?.url || '',
                      vocals: outputData[3]?.url || outputData[4]?.url || '',
                    };
                    
                    return NextResponse.json({
                      success: true,
                      status: 'completed',
                      stems: stems,
                      source: 'huggingface',
                      message: outputData[9] || 'Completed'
                    });
                  }
                } else if (data.msg === 'process_starts') {
                  isProcessing = true;
                } else if (data.msg === 'estimation') {
                  queuePosition = data.rank;
                  estimatedTime = data.queue_eta;
                } else if (data.msg === 'error') {
                  return NextResponse.json({
                    success: false,
                    status: 'failed',
                    error: data.output || 'Processing error occurred',
                    source: 'huggingface'
                  });
                }
              } catch (parseError) {
                // Skip invalid JSON lines
              }
            }
          }
          
          // Return current status
          if (isProcessing) {
            return NextResponse.json({
              success: null, // Still processing
              status: 'processing',
              message: 'Stem separation is currently processing...',
              source: 'huggingface'
            });
          } else if (queuePosition !== null) {
            return NextResponse.json({
              success: null, // Still in queue
              status: 'queued',
              queuePosition: queuePosition,
              estimatedTime: estimatedTime,
              message: `In queue position ${queuePosition}. Estimated time: ${estimatedTime}s`,
              source: 'huggingface'
            });
          }
        }
        
        // Default: still processing
        return NextResponse.json({
          success: null,
          status: 'processing',
          message: 'Job is still processing. Please check again in a few seconds.',
          source: 'huggingface'
        });
        
      } else {
        const errorText = await statusResponse.text();
        console.warn('Status check failed:', errorText);
        
        return NextResponse.json({
          success: false,
          status: 'error',
          error: 'Failed to check job status',
          details: errorText,
          source: 'huggingface'
        }, { status: statusResponse.status });
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