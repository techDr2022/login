self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/tasks', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin))
      if (!existing) {
        await self.clients.openWindow(target)
        return
      }
      await existing.focus()
      if (typeof existing.navigate === 'function') {
        try {
          await existing.navigate(target)
          return
        } catch {
          // Fall through and open a new tab when this client cannot navigate.
        }
      }
      await self.clients.openWindow(target)
    })()
  )
})
