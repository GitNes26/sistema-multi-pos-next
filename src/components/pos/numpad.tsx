"use client";

import { useEffect, useRef, useState } from "react";
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

const PHYSICAL_MAP: Record<string, NumpadKey> = {
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4",
  "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
  ".": ".", ",": ".",
  Backspace: "backspace",
  Delete: "clear",
  Escape: "clear",
};

interface NumpadProps {
  onKey: (key: NumpadKey) => void;
  onEnter?: () => void;
  className?: string;
  disabled?: boolean;
}

export function Numpad({ onKey, onEnter, className, disabled }: NumpadProps) {
  const [pressed, setPressed] = useState<NumpadKey | null>(null);
  const onKeyRef = useRef(onKey);
  const onEnterRef = useRef(onEnter);
  const disabledRef = useRef(disabled);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onKeyRef.current = onKey;
  }, [onKey]);

  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const trigger = (k: NumpadKey) => {
    setPressed(k);
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setPressed(null), 140);
    onKeyRef.current(k);
  };

  // Vínculo con el teclado físico: cada tecla anima su equivalente virtual.
  // No interfiere cuando el foco está en un campo de texto (referencia, puntos, etc.).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        target &&
        (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onEnterRef.current?.();
        return;
      }
      const k = PHYSICAL_MAP[e.key];
      if (!k) return;
      e.preventDefault();
      trigger(k);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onClick={() => trigger(k)}
          className={cn(
            "h-14 rounded-xl border bg-background text-xl font-semibold transition hover:bg-muted/60 active:scale-95 active:bg-muted disabled:opacity-40",
            pressed === k && "scale-95 bg-muted ring-2 ring-primary"
          )}
        >
          {LABELS[k]}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => trigger("clear")}
        className={cn(
          "col-span-3 h-11 rounded-xl border bg-destructive/10 text-sm font-semibold text-destructive transition hover:bg-destructive/20 active:scale-95 disabled:opacity-40",
          pressed === "clear" && "scale-95 bg-destructive/20 ring-2 ring-destructive"
        )}
      >
        {LABELS.clear}
      </button>
    </div>
  );
}
