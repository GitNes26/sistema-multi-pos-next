const CACHE_NAME = "multi-pos-v1"
const PRECACHE = ["/", "/sounds/notification.mp3", "/sounds/order-received.mp3", "/sounds/order-ready.mp3"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

self.addEventListener("push", (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()
    const title = data.title || "Multi-POS"
    const options = {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "multi-pos",
      data: data.url || "/",
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    // noop
  }
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
