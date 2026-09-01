"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import type { BusinessMode } from "@/lib/auth/options";
import {
  type FeatureKey,
  isFeatureEnabled,
  enabledFeatures,
} from "@/lib/features";

// ── useBusinessMode ────────────────────────────────────────────────
// Returns the current businessMode from the session.
// Falls back to "retail" if no session or no businessMode.

export function useBusinessMode(): BusinessMode {
  const { data: session } = useSession();
  return (session?.user as { businessMode?: BusinessMode } | undefined)
    ?.businessMode ?? "retail";
}

// ── useFeature ─────────────────────────────────────────────────────
// Check if a specific feature is enabled for the current businessMode.

export function useFeature(feature: FeatureKey): boolean {
  const mode = useBusinessMode();
  return useMemo(() => isFeatureEnabled(feature, mode), [feature, mode]);
}

// ── useEnabledFeatures ─────────────────────────────────────────────
// Returns all enabled features for the current businessMode.

export function useEnabledFeatures(): FeatureKey[] {
  const mode = useBusinessMode();
  return useMemo(() => enabledFeatures(mode), [mode]);
}

// ── useHasFeature ──────────────────────────────────────────────────
// Returns a function that checks if a feature is enabled.
// Useful for filtering arrays in useMemo.

export function useHasFeature(): (feature: FeatureKey) => boolean {
  const mode = useBusinessMode();
  return useMemo(() => {
    return (feature: FeatureKey) => isFeatureEnabled(feature, mode);
  }, [mode]);
}
