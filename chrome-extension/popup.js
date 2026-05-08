function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const t = url.trim().replace(/\/$/, '')
  if (!t.startsWith('http://') && !t.startsWith('https://')) return `https://${t}`.replace(/\/$/, '')
  return t
}

async function ensureOriginAccess(baseUrl) {
  const u = new URL(baseUrl)
  const origin = `${u.protocol}//${u.host}/*`
  const has = await chrome.permissions.contains({ origins: [origin] })
  if (has) return true
  return chrome.permissions.request({ origins: [origin] })
}

function splitTitleDescription(text) {
  const full = text.trim()
  if (!full) return { title: '', description: undefined }
  if (full.length <= 200) return { title: full, description: undefined }
  return { title: full.slice(0, 200), description: full }
}

function dueDateToIso(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim())
  if (!m) return null
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 18, 0, 0, 0)
  return dt.toISOString()
}

function show(el, text, ok) {
  el.textContent = text
  el.className = ok ? 'ok' : 'err'
}

async function fetchJson(baseUrl, path, token, options = {}) {
  let res
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
  } catch {
    throw new Error(
      `Network error (Failed to fetch). Check Base URL and grant extension site access for ${baseUrl}.`
    )
  }
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`)
  return payload
}

document.addEventListener('DOMContentLoaded', async () => {
  const loginView = document.getElementById('loginView')
  const taskView = document.getElementById('taskView')
  const loginMsg = document.getElementById('loginMsg')
  const taskMsg = document.getElementById('taskMsg')
  const userInfo = document.getElementById('userInfo')
  const sessionHint = document.getElementById('sessionHint')

  const emailEl = document.getElementById('email')
  const passwordEl = document.getElementById('password')
  const titleInput = document.getElementById('titleInput')
  const priorityEl = document.getElementById('priority')
  const dueDateEl = document.getElementById('dueDate')
  const assignedEl = document.getElementById('assignedToId')
  const clientEl = document.getElementById('clientId')
  const taskTypeEl = document.getElementById('taskType')

  const syncStorage = await chrome.storage.sync.get(['baseUrl'])
  const localStorage = await chrome.storage.local.get(['extensionToken', 'extensionUser'])
  const legacySync = await chrome.storage.sync.get(['extensionToken', 'extensionUser'])
  const baseUrl = normalizeBaseUrl(syncStorage.baseUrl)
  let token = localStorage.extensionToken || ''
  let user = localStorage.extensionUser || null

  // One-time migration from sync -> local for stable session persistence
  if (!token && legacySync.extensionToken) {
    token = legacySync.extensionToken
    user = legacySync.extensionUser || null
    await chrome.storage.local.set({ extensionToken: token, extensionUser: user })
  }
  if (sessionHint) {
    sessionHint.textContent = `Session: ${token ? 'saved' : 'not saved'}`
  }

  async function prefillFromWhatsApp() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id || !tab.url?.startsWith('https://web.whatsapp.com/')) return
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() || '',
      })
      const text = (injected[0]?.result || '').trim()
      if (text) titleInput.value = text
    } catch {
      // ignore
    }
  }

  function toggleTaskTypeDueDate() {
    dueDateEl.disabled = !!taskTypeEl.value
    if (taskTypeEl.value) dueDateEl.value = ''
  }
  taskTypeEl.addEventListener('change', toggleTaskTypeDueDate)

  async function loadBootstrap() {
    const data = await fetchJson(baseUrl, '/api/extension/bootstrap', token)

    assignedEl.innerHTML = '<option value="">Unassigned</option>'
    for (const u of data.users || []) {
      const opt = document.createElement('option')
      opt.value = u.id
      opt.textContent = `${u.name}${u.email ? ` (${u.email})` : ''}`
      assignedEl.appendChild(opt)
    }

    clientEl.innerHTML = '<option value="">None</option>'
    for (const c of data.clients || []) {
      const opt = document.createElement('option')
      opt.value = c.id
      opt.textContent = c.name
      clientEl.appendChild(opt)
    }

    taskTypeEl.innerHTML = '<option value="">None (manual due date)</option>'
    for (const t of data.templates || []) {
      const opt = document.createElement('option')
      opt.value = t.taskType
      opt.textContent = `${t.taskType} (${t.durationHours} ${t.durationHours === 1 ? 'hour' : 'hours'})`
      taskTypeEl.appendChild(opt)
    }
    toggleTaskTypeDueDate()
  }

  async function showTaskFlow() {
    if (!baseUrl) {
      loginView.hidden = false
      taskView.hidden = true
      show(loginMsg, 'Open settings and set Base URL first.', false)
      return
    }
    loginView.hidden = true
    taskView.hidden = false
    userInfo.textContent = `Logged in as ${user?.name || ''} (${user?.email || ''})`
    const granted = await ensureOriginAccess(baseUrl)
    if (!granted) {
      throw new Error(`Permission denied for ${baseUrl}. Open settings and save URL again.`)
    }
    await loadBootstrap()
    await prefillFromWhatsApp()
  }

  async function showLogin() {
    loginView.hidden = false
    taskView.hidden = true
    if (!baseUrl) show(loginMsg, 'Set Base URL in settings first.', false)
    else show(loginMsg, '', false)
  }

  if (token && user && baseUrl) {
    try {
      await showTaskFlow()
    } catch (err) {
      // Keep session sticky: never auto-logout on popup startup errors.
      loginView.hidden = true
      taskView.hidden = false
      userInfo.textContent = `Logged in as ${user?.name || ''} (${user?.email || ''})`
      show(taskMsg, err.message || String(err), false)
    }
  } else {
    await showLogin()
  }

  document.getElementById('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage())

  document.getElementById('loginBtn').addEventListener('click', async () => {
    if (!baseUrl) {
      show(loginMsg, 'Set Base URL in settings first.', false)
      return
    }
    const email = String(emailEl.value || '').trim()
    const password = String(passwordEl.value || '')
    if (!email || !password) {
      show(loginMsg, 'Enter email and password.', false)
      return
    }
    try {
      const granted = await ensureOriginAccess(baseUrl)
      if (!granted) {
        show(loginMsg, `Permission denied for ${baseUrl}.`, false)
        return
      }
      const data = await fetchJson(baseUrl, '/api/extension/login', '', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      token = data.token
      user = data.user
      await chrome.storage.local.set({ extensionToken: token, extensionUser: user })
      await chrome.storage.sync.set({ extensionToken: token, extensionUser: user })
      if (sessionHint) sessionHint.textContent = 'Session: saved'
      await showTaskFlow()
    } catch (err) {
      show(loginMsg, err.message || String(err), false)
    }
  })

  document.getElementById('createBtn').addEventListener('click', async () => {
    const base = splitTitleDescription(titleInput.value)
    if (!base.title) {
      show(taskMsg, 'Enter task text/title.', false)
      return
    }

    const body = {
      title: base.title,
      description: base.description,
      priority: priorityEl.value || 'Medium',
      assignedToId: assignedEl.value || undefined,
      clientId: clientEl.value || undefined,
      taskType: taskTypeEl.value || undefined,
      dueDate: taskTypeEl.value ? undefined : dueDateToIso(dueDateEl.value),
    }

    try {
      const granted = await ensureOriginAccess(baseUrl)
      if (!granted) {
        show(taskMsg, `Permission denied for ${baseUrl}.`, false)
        return
      }
      await fetchJson(baseUrl, '/api/extension/tasks', token, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      show(taskMsg, 'Task created successfully.', true)
      titleInput.value = ''
    } catch (err) {
      show(taskMsg, err.message || String(err), false)
    }
  })

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove(['extensionToken', 'extensionUser'])
    await chrome.storage.sync.remove(['extensionToken', 'extensionUser'])
    token = ''
    user = null
    await showLogin()
    show(loginMsg, 'Logged out.', true)
  })
})

