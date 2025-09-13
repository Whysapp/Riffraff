"use client";

import * as React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { id?: string };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={
        className ||
        'w-full px-3 py-2 bg-white/10 border border-purple-400/50 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400'
      }
      {...props}
    />
  );
});

