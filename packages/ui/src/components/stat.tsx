import * as React from "react";

import { cn } from "../lib/cn";

export interface StatProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string | number;
  unit?: string;
}

/** Monospaced, tabular-numeral stat value (spec §7.1). */
export function Stat({ value, unit, className, ...props }: StatProps) {
  return (
    <span className={cn("font-mono tabular-nums text-foreground", className)} {...props}>
      {value}
      {unit ? <span className="ml-0.5 text-xs text-muted">{unit}</span> : null}
    </span>
  );
}
