import * as React from 'react';

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & { htmlFor?: string };

export function Label({ className, ...props }: LabelProps) {
  return <label className={className || 'text-sm text-gray-300'} {...props} />;
}

