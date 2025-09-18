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

    // For now, return a helpful message about the limitations
    if (fileSizeMB > 5) {
      return NextResponse.json({
        success: false,
        error: 'File too large for reliable processing',
        message: 'HuggingFace Spaces have session timeouts for large files. Please use a file under 5MB for best results.',
        suggestion: 'Try compressing your audio file or using a shorter clip.',
        source: 'huggingface'
      }, { status: 413 });
    }

    // For smaller files, provide a direct link to the HuggingFace Space
    return NextResponse.json({
      success: false,
      error: 'Direct HuggingFace integration temporarily unavailable',
      message: 'Due to HuggingFace Spaces session limitations, please use the service directly.',
      directLink: 'https://huggingface.co/spaces/ahk-d/Spleeter-HT-Demucs-Stem-Separation-2025',
      instructions: [
        '1. Visit the HuggingFace Space above',
        '2. Upload your audio file directly',
        '3. Click "Separate Music" to process',
        '4. Download the separated stems'
      ],
      source: 'huggingface'
    }, { status: 503 });

  } catch (err: any) {
    console.error('Stem separation error:', err)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error during stem separation', 
      details: String(err?.message ?? err) 
    }, { status: 500 })
  }
}

