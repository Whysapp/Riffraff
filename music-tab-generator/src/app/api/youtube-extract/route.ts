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
    if (!format || !format.url) {
      return NextResponse.json({ error: 'Audio format not found' }, { status: 422 });
    }

    return NextResponse.json({ ok: true, audioUrl: format.url, title: info.videoDetails.title });
  } catch (error) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}

