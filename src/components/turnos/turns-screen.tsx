"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BellRing, CarFront, Check, Clock3, Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppearanceSync } from "@/components/appearance/appearance-sync";
import { useLiveStream } from "@/hooks/use-live-stream";
import { cn } from "@/lib/utils";
import type { TurnCard, TurnsBoard } from "@/lib/service-orders/turns-board";

// Pantalla de turnos para la clientela: en proceso (con sus etapas, tiempo transcurrido y estimado), cola en espera y
// listos. Avisa (banner + sonido + voz opcionales) cuando un vehículo termina. Solo muestra folio y vehículo: nunca
// datos personales. Se actualiza al instante por SSE y, por si se pierde la conexión, cada 30 s.

const POLL_MS = 30_000;
const TICK_MS = 15_000;
const ALERT_MS = 12_000;

const fmtMin = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`);
const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + 0.45);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* sin audio: el aviso visual basta */
  }
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-MX";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* sin voz */
  }
}

function Steps({ card }: { card: TurnCard }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Avance">
      {card.steps.map((s, i) => (
        <li key={`${s.label}-${i}`} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn("h-1.5 rounded-full", s.state === "done" ? "bg-primary" : s.state === "current" ? "animate-pulse bg-primary/60" : "bg-muted")} />
          <span className={cn("truncate text-[11px]", s.state === "current" ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function ProgressCard({ card, extraMin }: { card: TurnCard; extraMin: number }) {
  const elapsed = card.elapsedMin + extraMin;
  const remaining = card.remainingMin === null ? null : Math.max(0, card.remainingMin - extraMin);
  const overdue = card.overdue || (card.remainingMin !== null && card.remainingMin - extraMin <= 0);
  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-bold leading-none tabular-nums">#{card.number}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{card.vehicle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{card.stageLabel}</span>
      </header>
      <Steps card={card} />
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-muted/50 p-2">
          <dt className="text-xs text-muted-foreground">Transcurrido</dt>
          <dd className="font-semibold tabular-nums">{fmtMin(elapsed)}</dd>
        </div>
        <div className="rounded-xl bg-muted/50 p-2">
          <dt className="text-xs text-muted-foreground">Estimado</dt>
          <dd className="font-semibold tabular-nums">
            {remaining === null ? "Por confirmar" : overdue ? "Ya casi" : `~${fmtMin(remaining)}`}
            {card.estimatedReadyAt && !overdue ? <span className="ml-1 text-xs font-normal text-muted-foreground">({fmtClock(card.estimatedReadyAt)})</span> : null}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function TurnsScreen({ organizationName }: { organizationName: string }) {
  const [board, setBoard] = useState<TurnsBoard | null>(null);
  const [error, setError] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [alertCards, setAlertCards] = useState<TurnCard[]>([]);
  const knownReady = useRef<Set<string> | null>(null);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/turnos", { cache: "no-store", credentials: "include" });
      const json = (await res.json()) as { ok: boolean; board?: TurnsBoard };
      if (!res.ok || !json.ok || !json.board) throw new Error("fail");
      const next = json.board;
      // Aviso: lo que ahora está listo y antes no (la primera carga solo memoriza, no avisa).
      const ids = new Set(next.ready.map((c) => c.id));
      if (knownReady.current) {
        const fresh = next.ready.filter((c) => !knownReady.current!.has(c.id));
        if (fresh.length) {
          setAlertCards(fresh);
          if (soundRef.current) {
            chime();
            speak(fresh.length === 1 ? `Turno ${fresh[0].number}, su vehículo está listo` : `Turnos ${fresh.map((c) => c.number).join(", ")}, sus vehículos están listos`);
          }
        }
      }
      knownReady.current = ids;
      setBoard(next);
      setFetchedAt(Date.now());
      setNow(Date.now());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);
  useLiveStream("/api/service-orders/stream", () => void load());

  useEffect(() => {
    if (!alertCards.length) return;
    const t = setTimeout(() => setAlertCards([]), ALERT_MS);
    return () => clearTimeout(t);
  }, [alertCards]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  // Minutos que han pasado desde la última carga (así el reloj avanza sin pedir datos).
  const extraMin = Math.max(0, Math.floor((now - fetchedAt) / 60_000));

  const inProgress = board?.inProgress ?? [];
  const waiting = board?.waiting ?? [];
  const ready = board?.ready ?? [];

  return (
    <>
      <AppearanceSync tenant={null} />
      <div className="flex min-h-dvh flex-col gap-4 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6" data-guide="turns-screen">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="shrink-0" aria-label="Volver">
              <Link href="/admin/service-orders">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold sm:text-3xl">Turnos</h1>
              <p className="truncate text-sm text-muted-foreground">{organizationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {error ? <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive">Sin conexión, reintentando…</span> : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSound((s) => !s);
                if (!sound) chime();
              }}
              aria-pressed={sound}
            >
              {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              {sound ? "Sonido activo" : "Activar sonido"}
            </Button>
            <Button variant="outline" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          </div>
        </header>

        {alertCards.length ? (
          <div role="alert" aria-live="assertive" className="flex animate-pulse items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground">
            <BellRing className="size-9 shrink-0" />
            <div className="min-w-0">
              <p className="text-2xl font-bold sm:text-4xl">{alertCards.length === 1 ? `Turno #${alertCards[0].number} listo` : `Turnos ${alertCards.map((c) => `#${c.number}`).join(", ")} listos`}</p>
              <p className="truncate text-base opacity-90">{alertCards.map((c) => c.vehicle).join(" · ")} — pase por su vehículo</p>
            </div>
          </div>
        ) : null}

        {!board && !error ? (
          <p className="py-16 text-center text-muted-foreground">Cargando turnos…</p>
        ) : (
          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="flex flex-col gap-3 lg:col-span-2" aria-labelledby="turns-progress">
              <h2 id="turns-progress" className="flex items-center gap-2 text-lg font-semibold">
                <CarFront className="size-5 text-primary" /> En proceso
                <span className="rounded-full bg-muted px-2 text-sm tabular-nums">{inProgress.length}</span>
              </h2>
              {inProgress.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {inProgress.map((c) => (
                    <ProgressCard key={c.id} card={c} extraMin={extraMin} />
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground ring-1 ring-border">Nada en proceso por ahora.</p>
              )}
            </section>

            <div className="flex flex-col gap-4">
              <section aria-labelledby="turns-ready" className="flex flex-col gap-3">
                <h2 id="turns-ready" className="flex items-center gap-2 text-lg font-semibold">
                  <Check className="size-5 text-primary" /> Listos
                  <span className="rounded-full bg-muted px-2 text-sm tabular-nums">{ready.length}</span>
                </h2>
                {ready.length ? (
                  ready.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/30">
                      <div className="min-w-0">
                        <p className="text-2xl font-bold tabular-nums">#{c.number}</p>
                        <p className="truncate text-sm text-muted-foreground">{c.vehicle}</p>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-primary">
                        Listo{typeof c.readyForMin === "number" ? ` hace ${fmtMin(c.readyForMin + extraMin)}` : ""}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground ring-1 ring-border">Aún no hay vehículos listos.</p>
                )}
              </section>

              <section aria-labelledby="turns-waiting" className="flex flex-col gap-3">
                <h2 id="turns-waiting" className="flex items-center gap-2 text-lg font-semibold">
                  <Clock3 className="size-5 text-primary" /> En espera
                  <span className="rounded-full bg-muted px-2 text-sm tabular-nums">{waiting.length}</span>
                </h2>
                {waiting.length ? (
                  waiting.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
                      <div className="min-w-0">
                        <p className="text-xl font-bold tabular-nums">#{c.number}</p>
                        <p className="truncate text-sm text-muted-foreground">{c.vehicle}</p>
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        <p className="font-semibold">{c.position === 1 ? "Sigue" : `Lugar ${c.position}`}</p>
                        <p className="text-xs text-muted-foreground">Esperando {fmtMin(c.elapsedMin + extraMin)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground ring-1 ring-border">Sin cola de espera.</p>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
