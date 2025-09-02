import { NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    console.log('[youtube-extract] incoming', { url });
    if (!url || typeof url !== 'string') {
      console.error('[youtube-extract] missing url');
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }
    const valid = ytdl.validateURL(url);
    if (!valid) {
      console.error('[youtube-extract] invalid url');
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const info = await ytdl.getInfo(url);
    console.log('[youtube-extract] videoDetails', { title: info.videoDetails.title, lengthSeconds: info.videoDetails.lengthSeconds, formats: info.formats.length });
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    if (!format || !format.url) {
      console.error('[youtube-extract] no audio format');
      return NextResponse.json({ error: 'Audio format not found' }, { status: 422 });
    }

    // Return direct URL as metadata so client can call /api/fetch-audio to proxy fetch
    return NextResponse.json({ ok: true, audioUrl: format.url, title: info.videoDetails.title, itag: format.itag, mimeType: format.mimeType, lengthSeconds: info.videoDetails.lengthSeconds });
  } catch (error: any) {
    console.error('[youtube-extract] error', { message: error?.message, stack: error?.stack });
    return NextResponse.json({ error: 'Extraction failed', detail: error?.message ?? 'unknown' }, { status: 500 });
  }
}

