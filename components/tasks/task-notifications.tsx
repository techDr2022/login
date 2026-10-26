'use client'

import { useEffect, useRef } from 'react'
import { subscribeTaskEvents } from '@/lib/task-notification-stream'

interface TaskNotificationProps {
  onNewTask?: (task: any) => void
  onTaskCountUpdate?: (count: number) => void
}

export function useTaskNotifications({ onNewTask, onTaskCountUpdate }: TaskNotificationProps = {}) {
  const onNewTaskRef = useRef(onNewTask)
  const onTaskCountUpdateRef = useRef(onTaskCountUpdate)
  onNewTaskRef.current = onNewTask
  onTaskCountUpdateRef.current = onTaskCountUpdate

  useEffect(() => {
    return subscribeTaskEvents((event) => {
      if (event.type === 'task_count_update') {
        onTaskCountUpdateRef.current?.(event.count || 0)
        return
      }
      if (event.type === 'notification' && event.notification?.type === 'task_assigned') {
        const item = event.notification
        const data = item.data || {}
        onNewTaskRef.current?.({
          id: item.entityid,
          title: data.title || item.title,
          createdAt: item.createdat,
          assignedAt: data.assignedAt || item.createdat,
          assignedBy: { name: data.actorName || 'Someone' },
          assignedTo: { name: data.assigneeName || 'you' },
        })
        return
      }
      if (!event.task) return
      if (
        event.type === 'new_task' ||
        event.type === 'task_completed' ||
        (event.type === 'task_assigned' && event.assignedToMe)
      ) {
        onNewTaskRef.current?.(event.task)
      }
    })
  }, [])
}
