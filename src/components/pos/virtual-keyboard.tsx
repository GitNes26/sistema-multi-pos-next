"use client";

import { useRef, type RefObject } from "react";

const ROWS = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];

/**
 * 6.11 – Teclado virtual en pantalla para pantallas táctiles sin teclado físico.
 * Opera directamente sobre el input indicado por `target` (dispatch de eventos
 * de input para que React sincronice su estado).
 */
export function VirtualKeyboard({
  target,
  onDone,
}: {
  target: RefObject<HTMLInputElement | null>;
  onDone?: () => void;
}) {
  const lastSelection = useRef<{ start: number; end: number } | null>(null);

  const currentInput = () => target.current;

  const saveSelection = () => {
    const el = currentInput();
    if (!el) return;
    lastSelection.current = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  };

  const emit = (el: HTMLInputElement) => {
    const s = lastSelection.current ?? { start: el.value.length, end: el.value.length };
    el.focus();
    el.setSelectionRange(
      Math.min(s.start, el.value.length),
      Math.min(s.end, el.value.length)
    );
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const press = (char: string) => {
    const el = currentInput();
    if (!el) return;
    const s = lastSelection.current ?? {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
    const start = Math.min(s.start, el.value.length);
    const end = Math.min(s.end, el.value.length);
    if (char === "⌫") {
      el.value = start !== end ? el.value.slice(0, start) + el.value.slice(end) : el.value.slice(0, start - 1) + el.value.slice(end);
      lastSelection.current = { start: Math.max(0, start - (start !== end ? 0 : 1)), end: Math.max(0, start - (start !== end ? 0 : 1)) };
    } else if (char === " ") {
      el.value = el.value.slice(0, start) + " " + el.value.slice(end);
      lastSelection.current = { start: start + 1, end: start + 1 };
    } else if (char === "C") {
      el.value = "";
      lastSelection.current = { start: 0, end: 0 };
    } else {
      el.value = el.value.slice(0, start) + char + el.value.slice(end);
      lastSelection.current = { start: start + char.length, end: start + char.length };
    }
    emit(el);
  };

  return (
    <div className="select-none rounded-2xl border bg-muted/40 p-2">
      {ROWS.map((row) => (
        <div key={row} className="mb-1 flex justify-center gap-1 last:mb-0">
          {row.split("").map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => {
                saveSelection();
                press(ch);
              }}
              className="h-9 min-w-8 flex-1 rounded-lg border bg-background text-sm font-medium transition active:scale-95"
            >
              {ch}
            </button>
          ))}
        </div>
      ))}
      <div className="mt-1 flex gap-1">
        <button
          type="button"
          onClick={() => {
            saveSelection();
            press("C");
          }}
          className="h-9 flex-1 rounded-lg border bg-destructive/10 text-xs font-semibold text-destructive transition active:scale-95"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => {
            saveSelection();
            press(" ");
          }}
          className="h-9 flex-[3] rounded-lg border bg-background text-sm transition active:scale-95"
        >
          Espacio
        </button>
        <button
          type="button"
          onClick={() => {
            saveSelection();
            press("⌫");
          }}
          className="h-9 flex-1 rounded-lg border bg-background text-base transition active:scale-95"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-9 flex-1 rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground transition active:scale-95"
        >
          Listo
        </button>
      </div>
    </div>
  );
}