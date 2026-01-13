'use client'

import { useEffect, useRef, useState } from 'react'
import { playTaskSound, getTaskSoundEnabled, initChatSound } from '@/lib/chat-sound'

interface TaskNotificationProps {
  onNewTask?: (task: any) => void
  onTaskCountUpdate?: (count: number) => void
}

export function useTaskNotifications({ onNewTask, onTaskCountUpdate }: TaskNotificationProps = {}) {
  const previousTaskCountRef = useRef(0)
  const isInitializedRef = useRef(false)
  const isFirstCountUpdateRef = useRef(true) // Track if this is the first count update (initial load)
  const [notifyTaskUpdates, setNotifyTaskUpdates] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 3000

  // Fetch user notification preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await fetch('/api/users/notifications')
        if (res.ok) {
          const data = await res.json()
          setNotifyTaskUpdates(data.notifyTaskUpdates ?? true)
        } else {
          console.warn('[Notifications] Failed to fetch preferences, using defaults')
        }
      } catch (error) {
        console.error('[Notifications] Error fetching notification preferences:', error)
      }
    }
    fetchPreferences()
  }, [])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            console.log('[Notifications] Browser notification permission granted')
          } else if (permission === 'denied') {
            console.warn('[Notifications] Browser notification permission denied. Desktop notifications will not work.')
          }
        }).catch((error) => {
          console.error('[Notifications] Error requesting notification permission:', error)
        })
      } else if (Notification.permission === 'denied') {
        console.warn('[Notifications] Browser notifications are blocked. Please enable them in your browser settings.')
      }
    } else {
      console.warn('[Notifications] Browser does not support notifications')
    }
  }, [])

  useEffect(() => {
    // Initialize sound system
    if (!isInitializedRef.current) {
      initChatSound()
      isInitializedRef.current = true
    }

    // Cleanup any existing connections
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Set up SSE connection for real-time task updates
    const connectSSE = () => {
      try {
        console.log('[Notifications] Connecting to SSE endpoint...')
        const eventSource = new EventSource('/api/tasks/sse')
        eventSourceRef.current = eventSource
        reconnectAttemptsRef.current = 0

        eventSource.onopen = () => {
          console.log('[Notifications] SSE connection established')
          reconnectAttemptsRef.current = 0 // Reset on successful connection
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            // Handle connection message
            if (data.type === 'connected') {
              console.log('[Notifications] SSE connected, userId:', data.userId)
              reconnectAttemptsRef.current = 0 // Reset on successful connection
              return
            }
            
            // Handle heartbeat to confirm connection is alive
            if (data.type === 'heartbeat') {
              // Connection is alive, no action needed
              return
            }
            
            // Handle error messages from server
            if (data.type === 'error') {
              console.error('[Notifications] Server error:', data.message || data.error)
              return
            }
            
            if (data.type === 'new_task') {
              const task = data.task
              console.log('[Notifications] New task received:', task.title)
              
              // Only notify if user has task notifications enabled
              if (notifyTaskUpdates) {
                // Play sound notification if enabled
                if (getTaskSoundEnabled()) {
                  playTaskSound()
                } else {
                  console.log('[Notifications] Sound notifications disabled')
                }
                
                // Show desktop notification if permission granted
                if ('Notification' in window && Notification.permission === 'granted') {
                  try {
                    const assignedToName = task.assignedTo?.name || 'Unassigned'
                    const assignedByName = task.assignedBy?.name || 'Someone'
                    new Notification('New Task Created', {
                      body: `${assignedByName} created "${task.title}"${task.assignedTo ? ` assigned to ${assignedToName}` : ''}`,
                      icon: '/favicon.ico',
                      tag: `task-${task.id}`, // Prevent duplicate notifications
                    })
                    console.log('[Notifications] Desktop notification shown')
                  } catch (error) {
                    console.error('[Notifications] Error showing desktop notification:', error)
                  }
                } else {
                  console.log('[Notifications] Desktop notifications not available (permission:', Notification.permission, ')')
                }
              } else {
                console.log('[Notifications] Task notifications disabled in user preferences')
              }
              
              // Always call callback to update UI (even if notifications are disabled)
              if (onNewTask) {
                onNewTask(task)
              }
            } else if (data.type === 'task_completed') {
              const task = data.task
              console.log('[Notifications] Task completed:', task.title)
              
              // Only notify if user has task notifications enabled
              if (notifyTaskUpdates) {
                // Play sound notification if enabled
                if (getTaskSoundEnabled()) {
                  playTaskSound()
                }
                
                // Show desktop notification if permission granted
                if ('Notification' in window && Notification.permission === 'granted') {
                  try {
                    const completedByName = task.completedBy?.name || 'Someone'
                    const statusText = task.status === 'Review' ? 'completed' : 'approved'
                    new Notification('Task Completed', {
                      body: `${completedByName} has ${statusText} the task "${task.title}"`,
                      icon: '/favicon.ico',
                      tag: `task-completed-${task.id}`, // Prevent duplicate notifications
                    })
                    console.log('[Notifications] Desktop notification shown')
                  } catch (error) {
                    console.error('[Notifications] Error showing desktop notification:', error)
                  }
                }
              }
              
              // Always call callback to update UI (even if notifications are disabled)
              if (onNewTask) {
                onNewTask(task)
              }
            } else if (data.type === 'task_count_update') {
              const newCount = data.count || 0
              const oldCount = previousTaskCountRef.current
              
              // Skip sound on first count update (initial load) to prevent sounds when there are no new notifications
              // Only play sound if:
              // 1. This is not the first update (initial load)
              // 2. Count actually increased (not just initialized)
              // 3. Notifications are enabled
              // 4. Sound is enabled
              if (!isFirstCountUpdateRef.current && newCount > oldCount && notifyTaskUpdates && getTaskSoundEnabled()) {
                console.log('[Notifications] Task count increased from', oldCount, 'to', newCount)
                playTaskSound()
              }
              
              // Mark that we've processed the first update
              if (isFirstCountUpdateRef.current) {
                isFirstCountUpdateRef.current = false
              }
              
              previousTaskCountRef.current = newCount
              
              // Always call callback to update UI
              if (onTaskCountUpdate) {
                onTaskCountUpdate(newCount)
              }
            } else {
              console.log('[Notifications] Unknown SSE event type:', data.type)
            }
          } catch (error) {
            console.error('[Notifications] Error parsing task SSE message:', error, 'Data:', event.data)
          }
        }

        eventSource.onerror = (error) => {
          console.error('[Notifications] SSE connection error:', error)
          const state = eventSource.readyState
          
          if (state === EventSource.CLOSED) {
            console.log('[Notifications] SSE connection closed, attempting to reconnect...')
            eventSource.close()
            eventSourceRef.current = null
            
            // Exponential backoff for reconnection
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++
              const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1)
              console.log(`[Notifications] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
              
              reconnectTimeoutRef.current = setTimeout(() => {
                connectSSE()
              }, delay)
            } else {
              console.error('[Notifications] Max reconnection attempts reached. Please refresh the page.')
            }
          } else if (state === EventSource.CONNECTING) {
            console.log('[Notifications] SSE connecting...')
          }
        }
      } catch (error) {
        console.error('[Notifications] Error creating SSE connection:', error)
        // Retry connection after delay
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1)
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE()
          }, delay)
        }
      }
    }

    // Initial connection
    connectSSE()

    return () => {
      // Cleanup on unmount
      if (eventSourceRef.current) {
        console.log('[Notifications] Closing SSE connection')
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [onNewTask, onTaskCountUpdate, notifyTaskUpdates])
}

