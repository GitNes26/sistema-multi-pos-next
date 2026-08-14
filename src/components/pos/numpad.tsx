"use client";

import { cn } from "@/lib/utils";

export type NumpadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "backspace" | "clear";

const KEYS: NumpadKey[] = [
  "1", "2", "3",
  "4", "5", "6",
  "7", "8", "9",
  ".", "0", "backspace",
];

const LABELS: Record<NumpadKey, string> = {
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5",
  "6": "6", "7": "7", "8": "8", "9": "9", ".": ".",
  backspace: "⌫", clear: "C",
};

interface NumpadProps {
  onKey: (key: NumpadKey) => void;
  className?: string;
  disabled?: boolean;
}

export function Numpad({ onKey, className, disabled }: NumpadProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onClick={() => onKey(k)}
          className="h-14 rounded-xl border bg-background text-xl font-semibold transition active:scale-95 active:bg-muted disabled:opacity-40 hover:bg-muted/60"
        >
          {LABELS[k]}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onKey("clear")}
        className="col-span-3 h-11 rounded-xl border bg-destructive/10 text-sm font-semibold text-destructive transition active:scale-95 hover:bg-destructive/20 disabled:opacity-40"
      >
        {LABELS.clear}
      </button>
    </div>
  );
}