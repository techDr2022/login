'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { canManageTasks, canApproveTasks } from '@/lib/rbac'
import { UserRole, TaskStatus } from '@prisma/client'

export async function createTask(data: {
  title: string
  description?: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  status?: 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected'
  assignedToId?: string
  clientId?: string
  dueDate?: Date
  timeSpent?: number
  rejectionFeedback?: string
}) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageTasks(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  const validated = createTaskSchema.parse(data)
  
  const task = await prisma.task.create({
    data: {
      ...validated,
      assignedById: session.user.id,
      status: 'Pending', // Always start with Pending
    },
  })

  await logActivity(session.user.id, 'CREATE', 'Task', task.id)

  return task
}

export async function updateTask(id: string, data: {
  title?: string
  description?: string
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent'
  status?: 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected'
  assignedToId?: string
  clientId?: string
  dueDate?: Date | null
  timeSpent?: number
  rejectionFeedback?: string
}) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  const task = await prisma.task.findUnique({
    where: { id },
  })

  if (!task) throw new Error('Task not found')

  // Check if user can approve/reject
  if (data.status === 'Approved' || data.status === 'Rejected') {
    if (!canApproveTasks(session.user.role as UserRole)) {
      throw new Error('Only managers and admins can approve/reject tasks')
    }
    if (data.status === 'Rejected' && !data.rejectionFeedback) {
      throw new Error('Rejection feedback is required when rejecting a task')
    }
  }

  const validated = updateTaskSchema.parse(data)
  
  const updatedTask = await prisma.task.update({
    where: { id },
    data: validated,
  })

  await logActivity(session.user.id, 'UPDATE', 'Task', updatedTask.id)

  return updatedTask
}

export async function updateTaskStatus(id: string, data: {
  status: 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected'
  rejectionFeedback?: string
}) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  const task = await prisma.task.findUnique({
    where: { id },
  })

  if (!task) throw new Error('Task not found')

  // Check if user can approve/reject
  if (data.status === 'Approved' || data.status === 'Rejected') {
    if (!canApproveTasks(session.user.role as UserRole)) {
      throw new Error('Only managers and admins can approve/reject tasks')
    }
    if (data.status === 'Rejected' && !data.rejectionFeedback) {
      throw new Error('Rejection feedback is required when rejecting a task')
    }
  }

  const validated = updateTaskStatusSchema.parse(data)
  
  const updatedTask = await prisma.task.update({
    where: { id },
    data: validated,
  })

  await logActivity(session.user.id, 'UPDATE', 'Task', updatedTask.id)

  return updatedTask
}

export async function deleteTask(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageTasks(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  await prisma.task.delete({
    where: { id },
  })

  await logActivity(session.user.id, 'DELETE', 'Task', id)

  return { success: true }
}

