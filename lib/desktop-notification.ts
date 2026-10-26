const ICON_PATH = '/techdr-notification.png'
const DEDUPE_MS = 20000

type DesktopNotification = {
  title: string
  body: string
  tag: string
  url?: string
  silent?: boolean
  force?: boolean
}

type NotificationOptionsWithRenotify = NotificationOptions & { renotify?: boolean }

const recentTags = new Map<string, number>()
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null
let permissionPromptBound = false

export function registerNotificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register('/notification-sw.js')
      .catch((error) => {
        console.error('[Notifications] Service worker registration failed:', error)
        registrationPromise = null
        return null
      })
  }
  return registrationPromise
}

export function bindNotificationPermissionPrompt() {
  if (permissionPromptBound || typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'default') return
  permissionPromptBound = true
  const ask = () => {
    window.removeEventListener('pointerdown', ask)
    Notification.requestPermission().catch((error) => {
      console.error('[Notifications] Permission request failed:', error)
    })
  }
  window.addEventListener('pointerdown', ask)
}

export async function requestDesktopNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch (error) {
    console.error('[Notifications] Permission request failed:', error)
    return Notification.permission
  }
}

function rememberTag(tag: string) {
  const now = Date.now()
  if (recentTags.size > 200) {
    for (const [key, seenAt] of recentTags) {
      if (now - seenAt > DEDUPE_MS) recentTags.delete(key)
    }
  }
  recentTags.set(tag, now)
}

function alreadyShown(tag: string) {
  const seenAt = recentTags.get(tag)
  return seenAt !== undefined && Date.now() - seenAt < DEDUPE_MS
}

export async function showDesktopNotification(input: DesktopNotification): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  if (!input.force && alreadyShown(input.tag)) return false
  rememberTag(input.tag)

  const options: NotificationOptionsWithRenotify = {
    body: input.body,
    icon: new URL(ICON_PATH, window.location.origin).href,
    tag: input.tag,
    renotify: true,
    silent: input.silent ?? false,
    data: { url: input.url || '/tasks' },
  }

  const registration = await Promise.race([
    registerNotificationWorker(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
  ])

  if (registration) {
    try {
      await registration.showNotification(input.title, options)
      return true
    } catch (error) {
      console.error('[Notifications] Service worker notification failed:', error)
    }
  }

  try {
    const notification = new Notification(input.title, options)
    notification.onclick = () => {
      window.focus()
      if (input.url) window.location.assign(input.url)
      notification.close()
    }
    return true
  } catch (error) {
    console.error('[Notifications] Desktop notification failed:', error)
    return false
  }
}
