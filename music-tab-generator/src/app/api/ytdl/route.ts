import { NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    console.log('[ytdl] incoming', { url });
    if (!url || typeof url !== 'string') {
      console.error('[ytdl] missing url');
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }
    const valid = ytdl.validateURL(url);
    if (!valid) {
      console.error('[ytdl] invalid url');
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const info = await ytdl.getInfo(url);
    console.log('[ytdl] videoDetails', { title: info.videoDetails.title, lengthSeconds: info.videoDetails.lengthSeconds, formats: info.formats.length });
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    if (!format) {
      console.error('[ytdl] no audio format');
      return NextResponse.json({ error: 'No audio format available' }, { status: 422 });
    }
    try {
      const readable = ytdl.downloadFromInfo(info, {
        quality: 'highestaudio',
        filter: 'audioonly',
        dlChunkSize: 0,
        highWaterMark: 1 << 25,
        requestOptions: {
          headers: {
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            accept: '*/*',
          },
        },
      } as any);

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
    } catch (streamErr: any) {
      console.error('[ytdl] stream error, trying direct fetch fallback', { message: streamErr?.message });
      try {
        const upstream = await fetch(format.url, {
          headers: {
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            accept: '*/*',
            range: 'bytes=0-'
          },
        });
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '');
          console.error('[ytdl] direct fetch failed', { status: upstream.status, text: text.slice(0, 200) });
          return NextResponse.json({ error: 'Direct fetch failed', status: upstream.status }, { status: 502 });
        }
        const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
        const stream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
            } else {
              controller.enqueue(value);
            }
          },
          cancel() {
            reader.cancel();
          },
        });
        return new NextResponse(stream, {
          status: 200,
          headers: {
            'Content-Type': format.mimeType?.split(';')[0] || 'audio/mpeg',
            'Cache-Control': 'no-store',
          },
        });
      } catch (fetchErr: any) {
        console.error('[ytdl] fallback direct fetch error', { message: fetchErr?.message });
        return NextResponse.json({ error: 'Proxy failed', detail: fetchErr?.message ?? 'unknown' }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error('[ytdl] error', { message: error?.message, stack: error?.stack });
    return NextResponse.json({ error: 'Proxy failed', detail: error?.message ?? 'unknown' }, { status: 500 });
  }
}

