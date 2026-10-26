'use client'

import { initChatSound, playAlertSound, setSoundEnabled, setTaskSoundEnabled } from '@/lib/chat-sound'
import {
  bindNotificationPermissionPrompt,
  registerNotificationWorker,
  showDesktopNotification,
} from '@/lib/desktop-notification'

type TaskEvent = {
  type: string
  task?: any
  client?: { id: string; name: string; kind?: string }
  notification?: {
    id: string
    type: string
    title: string
    message: string
    link?: string | null
    entityid: string
    createdat: string
    data?: any
  }
  count?: number
  assignedToMe?: boolean
  userId?: string
  statusChange?: any
}

type TaskListener = (event: TaskEvent) => void

const listeners = new Set<TaskListener>()
const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_DELAY = 2000

let source: EventSource | null = null
let started = false
let attempts = 0
let lastHeartbeat = Date.now()
let notifyTaskUpdates = true
let notifyClientChanges = true
let notifyChatMentions = true
let currentUserId: string | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let onVisible: (() => void) | null = null
let onPreferencesChanged: (() => void) | null = null

export function subscribeTaskEvents(listener: TaskListener) {
  listeners.add(listener)
  start()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  initChatSound()
  registerNotificationWorker()
  bindNotificationPermissionPrompt()
  void loadPreferences()
  connect()

  heartbeatTimer = setInterval(() => {
    if (!started || !source) return
    if (Date.now() - lastHeartbeat <= 90000) return
    attempts = 0
    dropConnection()
    connect()
  }, 30000)

  onVisible = () => {
    if (document.visibilityState === 'visible' && started && !source) {
      attempts = 0
      connect()
    }
  }
  document.addEventListener('visibilitychange', onVisible)

  onPreferencesChanged = () => {
    void loadPreferences()
  }
  window.addEventListener('techdr-notification-prefs', onPreferencesChanged)
}

function stop() {
  started = false
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  reconnectTimer = null
  heartbeatTimer = null
  if (onVisible) document.removeEventListener('visibilitychange', onVisible)
  if (onPreferencesChanged) window.removeEventListener('techdr-notification-prefs', onPreferencesChanged)
  onVisible = null
  onPreferencesChanged = null
  dropConnection()
}

export function getNotificationPreferences() {
  return { notifyTaskUpdates, notifyClientChanges, notifyChatMentions }
}

async function loadPreferences() {
  try {
    const response = await fetch('/api/users/notifications')
    if (!response.ok) return
    const data = await response.json()
    notifyTaskUpdates = data.notifyTaskUpdates ?? true
    notifyClientChanges = data.notifyClientChanges ?? true
    notifyChatMentions = data.notifyChatMentions ?? true
    setTaskSoundEnabled(notifyTaskUpdates)
    setSoundEnabled(notifyChatMentions)
  } catch (error) {
    console.error('[Notifications] Error fetching notification preferences:', error)
  }
}

function dropConnection() {
  const current = source
  source = null
  current?.close()
}

function connect() {
  if (!started || source) return
  const eventSource = new EventSource('/api/tasks/sse')
  source = eventSource
  lastHeartbeat = Date.now()

  eventSource.onopen = () => {
    attempts = 0
    lastHeartbeat = Date.now()
  }

  eventSource.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as TaskEvent
      if (event.type === 'connected') {
        currentUserId = event.userId || null
        attempts = 0
        return
      }
      if (event.type === 'heartbeat') {
        lastHeartbeat = Date.now()
        return
      }
      if (event.type === 'error') return
      if (event.type === 'task_assigned' && event.task) {
        event.assignedToMe = Boolean(
          currentUserId &&
            (event.task.assignedTo?.id === currentUserId || event.task.assignedToId === currentUserId)
        )
      }
      void present(event)
      listeners.forEach((listener) => listener(event))
    } catch (error) {
      console.error('[Notifications] Error parsing task event:', error)
    }
  }

  eventSource.onerror = () => {
    if (!started || source !== eventSource) return
    if (eventSource.readyState !== EventSource.CLOSED) return
    dropConnection()
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (!started || reconnectTimer || attempts >= MAX_RECONNECT_ATTEMPTS) return
  attempts += 1
  const delay = Math.min(BASE_RECONNECT_DELAY * 2 ** (attempts - 1), 10000)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

function formatAssignedAt(value?: string | Date) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function present(event: TaskEvent) {
  if (event.type === 'notification' && event.notification) {
    const item = event.notification
    const isTask = item.type.startsWith('task_')
    if (isTask && !notifyTaskUpdates) return
    const soundOn = isTask && !document.hidden
    if (soundOn) playAlertSound()
    await showDesktopNotification({
      title: item.title,
      body: item.message,
      tag: item.id,
      url: item.link || `/tasks/${item.entityid}`,
      silent: soundOn,
    })
    return
  }

  if (event.type === 'client_change' && notifyClientChanges && event.client) {
    const soundOn = !document.hidden
    if (soundOn) playAlertSound()
    const created = event.client.kind !== 'onboarding'
    await showDesktopNotification({
      title: created ? 'New client' : 'Client onboarding completed',
      body: event.client.name,
      tag: `client-${event.client.id}-${event.client.kind || 'created'}`,
      url: `/clients/${event.client.id}`,
      silent: soundOn,
    })
    return
  }

  if (!notifyTaskUpdates || !event.task) return
  const task = event.task
  const soundOn = !document.hidden

  if (event.type === 'new_task') {
    if (task.assignedToId || task.assignedTo) return
    if (soundOn) playAlertSound()
    const assignedByName = task.assignedBy?.name || 'Someone'
    const assignedAt = formatAssignedAt(task.assignedAt || task.createdAt)
    await showDesktopNotification({
      title: 'New task created',
      body: [`${assignedByName} created "${task.title}"`, assignedAt].filter(Boolean).join('\n'),
      tag: `task-${task.id}`,
      url: '/tasks',
      silent: soundOn,
    })
    return
  }

  if (event.type === 'task_assigned') {
    if (soundOn) playAlertSound()
    const assignedByName = task.assignedBy?.name || 'Someone'
    const assignedToName = task.assignedTo?.name || 'an employee'
    const details = [task.client?.name, task.priority ? `${task.priority} priority` : '']
      .filter(Boolean)
      .join(' • ')
    const assignedAt = formatAssignedAt(task.assignedAt || task.createdAt)
    await showDesktopNotification({
      title: event.assignedToMe ? 'Task assigned to you' : 'Task assigned',
      body: [
        task.title,
        event.assignedToMe
          ? `Assigned by ${assignedByName}`
          : `${assignedByName} assigned this to ${assignedToName}`,
        details,
        assignedAt,
      ]
        .filter(Boolean)
        .join('\n'),
      tag: `task-assigned-${task.id}-${task.assignedToId || task.assignedTo?.id || ''}`,
      url: event.assignedToMe ? `/tasks/${task.id}` : '/tasks',
      silent: soundOn,
    })
    return
  }

  if (event.type === 'task_completed') {
    if (soundOn) playAlertSound()
    const completedByName = task.completedBy?.name || 'Someone'
    const statusText = task.status === 'Review' ? 'completed' : 'approved'
    await showDesktopNotification({
      title: 'Task completed',
      body: `${completedByName} has ${statusText} "${task.title}"`,
      tag: `task-completed-${task.id}`,
      url: `/tasks/${task.id}`,
      silent: soundOn,
    })
  }
}
