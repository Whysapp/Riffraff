import { NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string' || !ytdl.validateURL(url)) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    if (!format) {
      return NextResponse.json({ error: 'No audio format available' }, { status: 422 });
    }

    const readable = ytdl.downloadFromInfo(info, { quality: 'highestaudio', filter: 'audioonly' });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        readable.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        readable.on('end', () => controller.close());
        readable.on('error', (err: Error) => controller.error(err));
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}

