import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProcessRequest = {
  sourceId?: string;
  audioUrl?: string;
  instrumentKey: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProcessRequest;
    if (!body.instrumentKey) {
      return NextResponse.json({ error: 'instrumentKey is required' }, { status: 400 });
    }

    const tablature = [
      'E|–3–2–0–2–3–3–3–2–0–2–0–2–0–|',
      'B|–0–3–0–0–0–0–0–3–0–0–3–3–3–|',
      'G|–0–2–0–0–0–0–0–2–0–0–2–2–2–|',
      'D|–0–0–2–0–2–0–2–0–2–2–0–0–0–|',
      'A|–2–x–2–2–2–2–2–x–2–2–x–x–x–|',
      'E|–3–x–0–2–x–3–x–x–0–2–x–x–x–|',
    ];
    return NextResponse.json({ ok: true, tablature, bpm: 120, key: 'G Major' });
  } catch (error) {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

