const STORAGE_KEY = "multi-pos.sounds-enabled"

export type SoundName =
  | "notification"
  | "sale-complete"
  | "error"
  | "scan"
  | "cash-open"
  | "cash-close"
  | "order-received"
  | "order-ready"
  | "low-stock";

export interface PlaySoundOptions {
  volume?: number
  rate?: number
}

let enabled = typeof window !== "undefined"
  ? (localStorage.getItem(STORAGE_KEY) ?? "1") === "1"
  : true

export function setSoundsEnabled(value: boolean) {
  enabled = value
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  }
}

export function isSoundsEnabled() {
  return enabled
}

export function playSound(name: SoundName, options: PlaySoundOptions = {}) {
  if (!enabled || typeof window === "undefined") return
  const { volume = 1, rate = 1 } = options
  const audio = new Audio(`/sounds/${name}.mp3`)
  audio.volume = volume
  audio.playbackRate = rate
  audio.play().catch(() => {
    // Ignorar errores de reproducción (archivos placeholder, autoplay bloqueado)
  })
}

export function useSound() {
  return {
    play: playSound,
    setEnabled: setSoundsEnabled,
    isEnabled: isSoundsEnabled,
  }
}