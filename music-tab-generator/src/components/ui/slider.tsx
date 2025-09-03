"use client";

import * as React from 'react';

type SliderProps = {
  id?: string;
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (val: [number]) => void;
  className?: string;
};

export function Slider({ id, value, min = 0, max = 100, step = 1, onValueChange, className }: SliderProps) {
  const v = value?.[0] ?? 0;
  return (
    <input
      id={id}
      type="range"
      className={className}
      min={min}
      max={max}
      step={step}
      value={v}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
    />
  );
}

