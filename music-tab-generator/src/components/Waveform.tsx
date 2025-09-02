"use client";

import React, { useEffect, useRef } from 'react';

export default function Waveform({ data }: { data: Float32Array | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#a78bfa';
    ctx.fillStyle = 'rgba(167,139,250,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w && x < data.length; x += 1) {
      const v = data[x];
      const y = h / 2;
      const amp = v * (h / 2);
      ctx.moveTo(x + 0.5, y - amp);
      ctx.lineTo(x + 0.5, y + amp);
    }
    ctx.stroke();
  }, [data]);

  return (
    <canvas ref={canvasRef} width={600} height={100} className="w-full h-24 rounded bg-black/30" />
  );
}

