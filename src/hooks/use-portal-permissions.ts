"use client"

import { useState, useCallback, useEffect } from "react"

export type PortalPermissionType = "camera" | "geolocation" | "notifications"

const STORAGE_KEY = "multi-pos-portal-perms-v1"

interface PermissionStatus {
  camera: PermissionState | "unsupported"
  geolocation: PermissionState | "unsupported"
  notifications: PermissionState | "unsupported"
}

interface StoredPermissions {
  requestedTypes: string[]
  lastCheck: string
}

function getStorage(): StoredPermissions | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setStorage(data: StoredPermissions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // silent
  }
}

async function queryPermission(type: PortalPermissionType): Promise<PermissionState | "unsupported"> {
  if (type === "geolocation") {
    if (!navigator.geolocation) return "unsupported"
    try {
      const result = await navigator.permissions.query({ name: "geolocation" })
      return result.state
    } catch {
      return "unsupported"
    }
  }
  if (type === "notifications") {
    if (!("Notification" in window)) return "unsupported"
    return Notification.permission === "granted"
      ? "granted"
      : Notification.permission === "denied"
        ? "denied"
        : "prompt"
  }
  if (type === "camera") {
    if (!navigator.mediaDevices?.getUserMedia) return "unsupported"
    try {
      const result = await navigator.permissions.query({ name: "camera" as PermissionName })
      return result.state
    } catch {
      return "unsupported"
    }
  }
  return "unsupported"
}

const ALL_TYPES: PortalPermissionType[] = ["notifications", "geolocation", "camera"]

export function usePortalPermissions() {
  const [statuses, setStatuses] = useState<PermissionStatus>({
    camera: "unsupported",
    geolocation: "unsupported",
    notifications: "unsupported",
  })
  const [requestedTypes, setRequestedTypes] = useState<Set<string>>(new Set())

  const checkAll = useCallback(async () => {
    const [camera, geolocation, notifications] = await Promise.all([
      queryPermission("camera"),
      queryPermission("geolocation"),
      queryPermission("notifications"),
    ])
    setStatuses({ camera, geolocation, notifications })
  }, [])

  useEffect(() => {
    checkAll()
    const stored = getStorage()
    setRequestedTypes(new Set(stored?.requestedTypes ?? []))
  }, [checkAll])

  const markTypeRequested = useCallback((type: PortalPermissionType) => {
    setRequestedTypes((prev) => {
      const next = new Set(prev)
      next.add(type)
      setStorage({ requestedTypes: Array.from(next), lastCheck: new Date().toISOString() })
      return next
    })
  }, [])

  // Sliders se muestran solo para tipos que NO fueron solicitados aún
  const pendingTypes = ALL_TYPES.filter((t) => !requestedTypes.has(t))
  const needsPermissions = pendingTypes.length > 0

  return {
    statuses,
    requestedTypes,
    pendingTypes,
    needsPermissions,
    checkAll,
    markTypeRequested,
  }
}
