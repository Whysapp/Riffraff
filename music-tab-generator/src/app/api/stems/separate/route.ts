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

      console.log(`Using queue-based API approach`);
      
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
        lastError = `Upload failed: ${uploadResponse.status} ${uploadError}`;
        console.warn('File upload failed:', lastError);
      } else {
        const uploadResult = await uploadResponse.json();
        console.log('Upload result:', JSON.stringify(uploadResult, null, 2));
        
        // Get the uploaded file info
        const fileInfo = uploadResult[0];
        
        // Step 2: Join the queue
        const queuePayload = {
          data: [
            fileInfo,  // uploaded file info
            true,      // run_htdemucs
            true       // run_spleeter
          ],
          event_data: null,
          fn_index: 0,
          trigger_id: 10, // Button component ID from config
          session_hash: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        const queueResponse = await fetch(`${baseUrl}/gradio_api/queue/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(queuePayload),
        });
        
        console.log(`Queue join response status: ${queueResponse.status}`);
        
        if (queueResponse.ok) {
          const queueResult = await queueResponse.json();
          console.log('Queue result:', JSON.stringify(queueResult, null, 2));
          
          // Step 3: Poll for results using the correct Gradio queue format
          const eventId = queueResult.event_id;
          console.log(`Got event_id: ${eventId}, starting to poll for results`);
          
          if (eventId) {
            // Poll for completion with proper Gradio queue status checking
            const maxAttempts = 30; // 30 attempts = ~60 seconds
            let attempts = 0;
            
            while (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              attempts++;
              
              try {
                // Use Server-Sent Events endpoint for real-time updates
                const statusUrl = `${baseUrl}/gradio_api/queue/data?session_hash=${queuePayload.session_hash}`;
                console.log(`Poll attempt ${attempts}: checking ${statusUrl}`);
                
                const statusResponse = await fetch(statusUrl, {
                  method: 'GET',
                  headers: {
                    'Accept': 'text/event-stream',
                  },
                });
                
                if (statusResponse.ok) {
                  const statusText = await statusResponse.text();
                  console.log(`Poll attempt ${attempts} response:`, statusText.substring(0, 500));
                  
                  // Parse SSE format: look for "data: " lines
                  const lines = statusText.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.substring(6));
                        console.log(`SSE data:`, data);
                        
                        if (data.msg === 'process_completed' && data.output) {
                          // Process successful result
                          const outputData = data.output.data;
                          if (Array.isArray(outputData) && outputData.length >= 4) {
                            const stems = {
                              drums: outputData[0]?.url || outputData[5]?.url || '',
                              bass: outputData[1]?.url || outputData[6]?.url || '',
                              other: outputData[2]?.url || outputData[7]?.url || '',
                              vocals: outputData[3]?.url || outputData[4]?.url || '',
                            };
                            
                            console.log('Successfully extracted stems:', stems);
                            
                            return NextResponse.json({
                              success: true,
                              stems: stems,
                              source: 'huggingface',
                              status: outputData[9] || 'Completed',
                            });
                          }
                        } else if (data.msg === 'process_starts') {
                          console.log('Processing started...');
                        } else if (data.msg === 'estimation') {
                          console.log(`Queue position: ${data.rank}, estimated time: ${data.queue_eta}s`);
                        } else if (data.msg === 'error') {
                          lastError = data.output || 'Processing error occurred';
                          console.error('Processing error:', data);
                          break;
                        }
                      } catch (parseError) {
                        // Skip invalid JSON lines
                      }
                    }
                  }
                } else {
                  console.warn(`Poll attempt ${attempts} failed with status: ${statusResponse.status}`);
                }
              } catch (pollError) {
                console.warn(`Poll attempt ${attempts} failed:`, pollError);
              }
            }
            
            if (attempts >= maxAttempts) {
              lastError = 'Processing timeout after 60 seconds - the file may be too large or the service is busy';
              console.warn('Polling timeout reached');
            }
          } else {
            lastError = 'Failed to get event_id from queue join response';
            console.error('No event_id in queue result:', queueResult);
          }
        } else {
          const queueError = await queueResponse.text();
          lastError = `Queue join failed: ${queueResponse.status} ${queueError}`;
          console.warn('Queue join failed:', lastError);
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

