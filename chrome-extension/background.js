const MENU_ADD_TASK = 'wtt-add-task-selection'
const MENU_SETTINGS = 'wtt-open-settings'

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    title,
    message: String(message || '').slice(0, 250),
  })
}

async function ensureContextMenus() {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: MENU_ADD_TASK,
    title: 'Create task from selection',
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
  await chrome.storage.local.set({ pendingSelection: info.selectionText.trim() })
  try {
    await chrome.action.openPopup()
  } catch {
    notify('Selection saved', 'Open the extension and confirm the task.')
  }
})

