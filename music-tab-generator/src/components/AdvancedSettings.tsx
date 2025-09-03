"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AdvancedValues = { minHz: number; maxHz: number; sensitivity: number };

export function AdvancedSettings({
  value,
  onChange,
  defaults = { minHz: 70, maxHz: 1500, sensitivity: 50 },
}: {
  value: AdvancedValues;
  onChange: (v: AdvancedValues) => void;
  defaults?: AdvancedValues;
}) {
  const [open, setOpen] = useState(false);
  const v = value ?? defaults;
  const update = (p: Partial<AdvancedValues>) => onChange({ ...v, ...p });

  const invalid = v.minHz < 0 || v.maxHz <= 0 || v.minHz >= v.maxHz;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <div className="text-sm font-medium">Advanced settings</div>
        <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
      </button>

      <p className="mt-1 text-xs text-white/60">Tweak frequency range and sensitivity.</p>

      {open && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="minHz">Min frequency (Hz)</Label>
            <Input
              id="minHz"
              type="number"
              inputMode="numeric"
              min={0}
              value={v.minHz}
              onChange={(e) => update({ minHz: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxHz">Max frequency (Hz)</Label>
            <Input
              id="maxHz"
              type="number"
              inputMode="numeric"
              min={1}
              value={v.maxHz}
              onChange={(e) => update({ maxHz: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sensitivity">Sensitivity</Label>
              <span className="text-xs text-white/70">{v.sensitivity}</span>
            </div>
            <Slider id="sensitivity" value={[v.sensitivity]} min={0} max={100} step={1} onValueChange={([val]) => update({ sensitivity: val })} />
          </div>

          {invalid && <p className="sm:col-span-2 text-xs text-red-400">Min must be ≥ 0, Max &gt; 0, and Min &lt; Max.</p>}
        </div>
      )}
    </div>
  );
}

