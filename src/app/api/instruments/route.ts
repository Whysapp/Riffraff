import { NextResponse } from 'next/server';
import { INSTRUMENTS } from '@/lib/instruments';

export async function GET() {
  return NextResponse.json({ instruments: INSTRUMENTS });
}

