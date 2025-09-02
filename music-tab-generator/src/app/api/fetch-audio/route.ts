import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAllowedUpstream(u: string): boolean {
  try {
    const url = new URL(u);
    return (
      url.hostname.endsWith('.googlevideo.com') ||
      url.hostname === 'rr1---sn' ||
      url.hostname.includes('googlevideo') ||
      url.hostname === 'youtube.com' ||
      url.hostname.endsWith('.youtube.com')
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    console.log('[fetch-audio] incoming', { url });
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }
    if (!isAllowedUpstream(url)) {
      console.error('[fetch-audio] blocked upstream', { url });
      return NextResponse.json({ error: 'Upstream not allowed' }, { status: 400 });
    }
    const upstream = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        accept: '*/*',
        range: 'bytes=0-'
      },
    });
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      console.error('[fetch-audio] upstream failed', { status: upstream.status, text: text.slice(0, 200) });
      return NextResponse.json({ error: `Upstream failed: ${upstream.status}` }, { status: 502 });
    }
    const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      cancel() {
        reader.cancel();
      },
    });
    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    return new NextResponse(stream, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('[fetch-audio] error', { message: error?.message, stack: error?.stack });
    return NextResponse.json({ error: 'Fetch proxy failed', detail: error?.message ?? 'unknown' }, { status: 500 });
  }
}

