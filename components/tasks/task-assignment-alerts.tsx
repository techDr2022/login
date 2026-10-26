'use client'

import { useTaskNotifications } from '@/components/tasks/task-notifications'

/** Keeps Chrome task-assignment alerts running on pages that do not render the top bar. */
export function TaskAssignmentAlerts() {
  useTaskNotifications()
  return null
}
