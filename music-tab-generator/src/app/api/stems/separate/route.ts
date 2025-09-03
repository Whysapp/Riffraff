import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const baseUrl = process.env.STEMS_BASE_URL
  if (!baseUrl) {
    return NextResponse.json({ error: 'STEMS_BASE_URL not configured' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const forwardForm = new FormData()
    forwardForm.append('file', file, (file as any).name ?? 'audio.wav')

    const url = `${baseUrl.replace(/\/$/, '')}/separate`
    const resp = await fetch(url, {
      method: 'POST',
      body: forwardForm as any,
    })

    if (!resp.ok) {
      const text = await resp.text()
      return NextResponse.json({ error: 'Separation failed', details: text }, { status: resp.status })
    }

    // Proxy back the zip file
    const arrayBuffer = await resp.arrayBuffer()
    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="stems.zip"',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Proxy error', details: String(err?.message ?? err) }, { status: 500 })
  }
}

