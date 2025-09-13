import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const sizeLimit = 100 * 1024 * 1024; // 100MB
    if (file.size > sizeLimit) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const typeOk = file.type.startsWith('audio/') || file.type.startsWith('video/');
    if (!typeOk) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);

    const tempId = `upload_${Date.now()}`;
    return NextResponse.json({ ok: true, id: tempId, size: bytes.length, mime: file.type });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

