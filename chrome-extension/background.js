const MENU_ADD_TASK = 'wtt-add-task-selection'
const MENU_SETTINGS = 'wtt-open-settings'

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim().replace(/\/$/, '')
  if (!t.startsWith('http://') && !t.startsWith('https://')) {
    return `https://${t}`.replace(/\/$/, '')
  }
  return t
}

async function ensureOriginAccess(baseUrl) {
  const u = new URL(baseUrl)
  const origin = `${u.protocol}//${u.host}/*`
  const has = await chrome.permissions.contains({ origins: [origin] })
  if (has) return true
  return chrome.permissions.request({ origins: [origin] })
}

function parseDueDateToIso(dateStr) {
  const s = String(dateStr || '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  return new Date(y, mo, d, 18, 0, 0, 0).toISOString()
}

function splitTitleDescription(text) {
  const full = text.trim()
  if (!full) throw new Error('No text selected.')
  if (full.length <= 200) return { title: full, description: undefined }
  return { title: full.slice(0, 200), description: full }
}

async function buildTaskBody(text) {
  const defaults = await chrome.storage.sync.get([
    'defaultPriority',
    'defaultAssignedToId',
    'defaultClientId',
    'defaultTaskType',
    'defaultDueDate',
  ])
  const { title, description } = splitTitleDescription(text)
  const body = {
    title,
    description,
    priority: defaults.defaultPriority || 'Medium',
  }
  if (defaults.defaultAssignedToId) body.assignedToId = defaults.defaultAssignedToId
  if (defaults.defaultClientId) body.clientId = defaults.defaultClientId
  if (defaults.defaultTaskType) body.taskType = defaults.defaultTaskType
  else if (defaults.defaultDueDate) {
    const iso = parseDueDateToIso(defaults.defaultDueDate)
    if (iso) body.dueDate = iso
  }
  return body
}

async function createTaskFromSelection(text) {
  const { baseUrl: baseRaw } = await chrome.storage.sync.get(['baseUrl'])
  const local = await chrome.storage.local.get(['extensionToken'])
  const legacy = await chrome.storage.sync.get(['extensionToken'])
  const extensionToken = local.extensionToken || legacy.extensionToken || ''
  if (!local.extensionToken && legacy.extensionToken) {
    await chrome.storage.local.set({ extensionToken: legacy.extensionToken })
    await chrome.storage.sync.remove(['extensionToken'])
  }
  const baseUrl = normalizeBaseUrl(baseRaw)
  if (!baseUrl) throw new Error('Set app URL in extension settings.')
  if (!extensionToken) throw new Error('Login first from extension popup.')
  const granted = await ensureOriginAccess(baseUrl)
  if (!granted) throw new Error(`Permission denied for ${baseUrl}.`)

  const body = await buildTaskBody(text)
  let res
  try {
    res = await fetch(`${baseUrl}/api/extension/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(`Network error (Failed to fetch) for ${baseUrl}.`)
  }
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`)
  return payload
}

function notify(title, message, isError) {
  chrome.notifications.create({
    type: 'basic',
    title,
    message: String(message || '').slice(0, 250),
    priority: isError ? 2 : 0,
  })
}

async function ensureContextMenus() {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: MENU_ADD_TASK,
    title: 'Add selection as task',
    contexts: ['selection'],
    documentUrlPatterns: ['https://web.whatsapp.com/*'],
  })
  chrome.contextMenus.create({
    id: MENU_SETTINGS,
    title: 'Extension settings…',
    contexts: ['action', 'page'],
    documentUrlPatterns: ['https://web.whatsapp.com/*'],
  })
}

chrome.runtime.onInstalled.addListener(ensureContextMenus)
chrome.runtime.onStartup.addListener(ensureContextMenus)

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === MENU_SETTINGS) {
    chrome.runtime.openOptionsPage()
    return
  }
  if (info.menuItemId !== MENU_ADD_TASK || !info.selectionText) return
  try {
    await createTaskFromSelection(info.selectionText)
    notify('Task created', info.selectionText.trim().slice(0, 120), false)
  } catch (e) {
    notify('Could not create task', e.message || String(e), true)
  }
})

