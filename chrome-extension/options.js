function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim().replace(/\/$/, '')
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`.replace(/\/$/, '')
  return t
}

function show(el, text, ok) {
  el.textContent = text
  el.className = ok ? 'ok' : 'err'
}

document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status')
  const defaultsStatus = document.getElementById('defaultsStatus')
  const baseUrlInput = document.getElementById('baseUrl')
  const defaultPriority = document.getElementById('defaultPriority')
  const defaultAssignedToId = document.getElementById('defaultAssignedToId')
  const defaultClientId = document.getElementById('defaultClientId')
  const defaultTaskType = document.getElementById('defaultTaskType')
  const defaultDueDate = document.getElementById('defaultDueDate')

  const saved = await chrome.storage.sync.get([
    'baseUrl',
    'defaultPriority',
    'defaultAssignedToId',
    'defaultClientId',
    'defaultTaskType',
    'defaultDueDate',
  ])
  if (saved.baseUrl) baseUrlInput.value = saved.baseUrl
  if (saved.defaultPriority) defaultPriority.value = saved.defaultPriority
  if (saved.defaultAssignedToId) defaultAssignedToId.value = saved.defaultAssignedToId
  if (saved.defaultClientId) defaultClientId.value = saved.defaultClientId
  if (saved.defaultTaskType) defaultTaskType.value = saved.defaultTaskType
  if (saved.defaultDueDate) defaultDueDate.value = saved.defaultDueDate

  document.getElementById('urlForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const baseUrl = normalizeBaseUrl(baseUrlInput.value)
    if (!baseUrl) {
      show(status, 'Enter a valid base URL.', false)
      return
    }
    try {
      await chrome.storage.sync.set({ baseUrl })
      show(status, 'Saved.', true)
    } catch (err) {
      show(status, err.message || String(err), false)
    }
  })

  document.getElementById('defaultsForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      await chrome.storage.sync.set({
        defaultPriority: defaultPriority.value,
        defaultAssignedToId: defaultAssignedToId.value.trim(),
        defaultClientId: defaultClientId.value.trim(),
        defaultTaskType: defaultTaskType.value.trim(),
        defaultDueDate: defaultDueDate.value.trim(),
      })
      show(defaultsStatus, 'Defaults saved.', true)
    } catch (err) {
      show(defaultsStatus, err.message || String(err), false)
    }
  })

  document.getElementById('clearSession').addEventListener('click', async () => {
    await chrome.storage.local.remove(['extensionToken', 'extensionUser'])
    await chrome.storage.sync.remove(['extensionToken', 'extensionUser'])
    show(status, 'Saved login cleared. Reopen popup to login again.', true)
  })
})

