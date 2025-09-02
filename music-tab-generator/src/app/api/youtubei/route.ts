import { NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    console.log('[youtubei] incoming', { url });
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }
    const yt = await Innertube.create();
    const videoId = new URL(url).searchParams.get('v') ?? url.split('v=')[1];
    if (!videoId) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    const info = await yt.getInfo(videoId);
    const best = info?.streaming_data?.adaptive_formats?.find((f: any) => f.mime_type?.includes('audio') && f.audio_quality === 'AUDIO_QUALITY_MEDIUM')
      || info?.streaming_data?.adaptive_formats?.find((f: any) => f.mime_type?.includes('audio'));
    if (!best?.url) {
      console.error('[youtubei] no adaptive audio');
      return NextResponse.json({ error: 'No audio stream found' }, { status: 422 });
    }
    return NextResponse.json({ ok: true, audioUrl: best.url, mimeType: best.mime_type });
  } catch (error: any) {
    console.error('[youtubei] error', { message: error?.message });
    return NextResponse.json({ error: 'youtubei failed', detail: error?.message ?? 'unknown' }, { status: 500 });
  }
}

