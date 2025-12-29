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
  const [notifyTaskUpdates, setNotifyTaskUpdates] = useState(true)

  // Fetch user notification preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await fetch('/api/users/notifications')
        if (res.ok) {
          const data = await res.json()
          setNotifyTaskUpdates(data.notifyTaskUpdates ?? true)
        }
      } catch (error) {
        console.error('Failed to fetch notification preferences:', error)
      }
    }
    fetchPreferences()
  }, [])

  useEffect(() => {
    // Initialize sound system
    if (!isInitializedRef.current) {
      initChatSound()
      isInitializedRef.current = true
    }

    // Set up SSE connection for real-time task updates
    const eventSource = new EventSource('/api/tasks/sse')

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'new_task') {
          const task = data.task
          
          // Only notify if user has task notifications enabled
          if (notifyTaskUpdates) {
            // Play sound notification if enabled
            if (getTaskSoundEnabled()) {
              playTaskSound()
            }
            
            // Show desktop notification if permission granted
            if ('Notification' in window && Notification.permission === 'granted') {
              const assignedToName = task.assignedTo?.name || 'Unassigned'
              const assignedByName = task.assignedBy?.name || 'Someone'
              new Notification('New Task Created', {
                body: `${assignedByName} created "${task.title}"${task.assignedTo ? ` assigned to ${assignedToName}` : ''}`,
                icon: '/favicon.ico',
                tag: `task-${task.id}`, // Prevent duplicate notifications
              })
            }
          }
          
          // Always call callback to update UI (even if notifications are disabled)
          if (onNewTask) {
            onNewTask(task)
          }
        } else if (data.type === 'task_count_update') {
          const newCount = data.count || 0
          const oldCount = previousTaskCountRef.current
          
          // Play sound if count increased and notifications are enabled
          if (newCount > oldCount && notifyTaskUpdates && getTaskSoundEnabled()) {
            playTaskSound()
          }
          
          previousTaskCountRef.current = newCount
          
          // Always call callback to update UI
          if (onTaskCountUpdate) {
            onTaskCountUpdate(newCount)
          }
        }
      } catch (error) {
        console.error('Error parsing task SSE message:', error)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      // Reconnect after 3 seconds
      setTimeout(() => {
        // The effect will re-run and create a new connection
      }, 3000)
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      eventSource.close()
    }
  }, [onNewTask, onTaskCountUpdate, notifyTaskUpdates])
}

