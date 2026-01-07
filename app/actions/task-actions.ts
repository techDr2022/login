'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { canManageTasks, canApproveTasks } from '@/lib/rbac'
import { UserRole, TaskStatus } from '@prisma/client'
import { sendWhatsAppNotification, formatTaskAssignmentMessage, getTaskAssignmentTemplateVariables } from '@/lib/whatsapp'

export async function createTask(data: {
  title: string
  description?: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  status?: 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected'
  assignedToId?: string
  clientId?: string
  taskType?: string
  dueDate?: Date
  timeSpent?: number
  rejectionFeedback?: string
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized: No session found')
  }

  if (!session.user) {
    throw new Error('Unauthorized: No user in session')
  }

  const userId = session.user.id

  // Check if user ID exists and is not empty
  if (!userId || userId.trim() === '') {
    // This usually means the user was deleted or deactivated
    // The session callback in auth.ts sets user.id to '' for invalid users
    throw new Error('Unauthorized: Session user is invalid. Please log out and log back in.')
  }

  // Verify user exists and is active
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  })

  if (!user || !user.isActive) {
    throw new Error('User not found or inactive')
  }

  // Validate assignedToId if provided
  if (data.assignedToId) {
    const assignedToUser = await prisma.user.findUnique({
      where: { id: data.assignedToId },
      select: { id: true, isActive: true },
    })
    if (!assignedToUser || !assignedToUser.isActive) {
      throw new Error('Assigned user not found or inactive')
    }
  }

  // Validate clientId if provided
  if (data.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true },
    })
    if (!client) {
      throw new Error('Client not found')
    }
  }

  // All authenticated users can create tasks
  const validated = createTaskSchema.parse(data)
  
  // Set start date to current time
  const startDate = new Date()
  
  // Calculate due date from TaskTemplate if taskType is provided
  let dueDate: Date | undefined = undefined
  if (validated.taskType) {
    const template = await prisma.taskTemplate.findUnique({
      where: { taskType: validated.taskType },
      select: { durationHours: true, isActive: true },
    })
    
    if (!template) {
      throw new Error(`Task template not found for type: ${validated.taskType}`)
    }
    
    if (!template.isActive) {
      throw new Error(`Task template is inactive for type: ${validated.taskType}`)
    }
    
    // Calculate due date: startDate + durationHours
    dueDate = new Date(startDate.getTime() + template.durationHours * 60 * 60 * 1000)
  } else if (validated.dueDate) {
    // If no taskType but dueDate provided, use it (backward compatibility)
    dueDate = validated.dueDate
  }
  
  // Convert empty string to undefined for optional fields
  const taskData: any = {
    id: randomUUID(),
    ...validated,
    assignedById: userId,
    status: 'Pending', // Always start with Pending
    startDate,
    dueDate,
  }
  
  // Remove dueDate from validated if we calculated it from template
  if (validated.taskType) {
    delete taskData.dueDate
    taskData.dueDate = dueDate
  }
  
  // Handle empty strings for optional fields
  if (taskData.assignedToId === '') {
    taskData.assignedToId = null
  }
  if (taskData.clientId === '') {
    taskData.clientId = null
  }
  if (taskData.taskType === '') {
    taskData.taskType = null
  }
  
  const task = await prisma.task.create({
    data: taskData,
    include: {
      User_Task_assignedByIdToUser: {
        select: { name: true },
      },
      User_Task_assignedToIdToUser: {
        select: { id: true, name: true, phoneNumber: true, notifyTaskUpdates: true },
      },
      Client: {
        select: { name: true },
      },
    },
  })

  await logActivity(userId, 'CREATE', 'Task', task.id)

  // Send WhatsApp notification if task is assigned to an employee
  if (task.assignedToId && task.User_Task_assignedToIdToUser) {
    const assignedToUser = task.User_Task_assignedToIdToUser
    
    console.log(`[WhatsApp] Task assigned to user: ${assignedToUser.name} (${assignedToUser.id})`)
    console.log(`[WhatsApp] Phone number: ${assignedToUser.phoneNumber || 'NOT SET'}`)
    console.log(`[WhatsApp] Notify task updates: ${assignedToUser.notifyTaskUpdates}`)
    
    // Only send if user has phone number and notifications enabled
    if (!assignedToUser.phoneNumber) {
      console.warn(`[WhatsApp] Skipping notification: User ${assignedToUser.name} does not have a phone number`)
    } else if (!assignedToUser.notifyTaskUpdates) {
      console.warn(`[WhatsApp] Skipping notification: User ${assignedToUser.name} has task notifications disabled`)
    } else {
      try {
        const message = formatTaskAssignmentMessage(
          task.title,
          task.User_Task_assignedByIdToUser.name,
          task.priority,
          task.dueDate || undefined,
          task.Client?.name
        )

        // Get template variables for template-based messages
        const templateVariables = getTaskAssignmentTemplateVariables(
          task.title,
          task.User_Task_assignedByIdToUser.name,
          task.priority,
          task.dueDate || undefined,
          task.Client?.name
        )

        console.log(`[WhatsApp] Attempting to send notification to ${assignedToUser.phoneNumber}`)
        const result = await sendWhatsAppNotification(assignedToUser.phoneNumber, message, templateVariables)
        
        if (result.success) {
          console.log(`[WhatsApp] ✅ Notification sent successfully. Message ID: ${result.messageId || 'N/A'}`)
        } else {
          console.error(`[WhatsApp] ❌ Failed to send notification: ${result.error}`)
          // Don't throw error - task creation should succeed even if notification fails
        }
      } catch (error) {
        console.error('[WhatsApp] ❌ Error sending WhatsApp notification:', error)
        // Don't throw error - task creation should succeed even if notification fails
      }
    }
  } else {
    console.log('[WhatsApp] Task not assigned to any user, skipping notification')
  }

  return task
}

export async function updateTask(id: string, data: {
  title?: string
  description?: string
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent'
  status?: 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected'
  assignedToId?: string
  clientId?: string
  taskType?: string
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

  // Validate assignedToId if provided
  if (data.assignedToId !== undefined) {
    if (data.assignedToId) {
      const assignedToUser = await prisma.user.findUnique({
        where: { id: data.assignedToId },
        select: { id: true, isActive: true },
      })
      if (!assignedToUser || !assignedToUser.isActive) {
        throw new Error('Assigned user not found or inactive')
      }
    }
    // If assignedToId is empty string, convert to null to unassign
    if (data.assignedToId === '') {
      data.assignedToId = null as any
    }
  }

  const userRole = session.user.role as UserRole
  const isEmployee = userRole === UserRole.EMPLOYEE

  // Check if user can approve/reject
  // Employees can approve their own tasks, but cannot reject them
  if (data.status === 'Rejected') {
    if (!canApproveTasks(userRole)) {
      throw new Error('Only admins can reject tasks')
    }
    if (!data.rejectionFeedback) {
      throw new Error('Rejection feedback is required when rejecting a task')
    }
  }

  // Allow employees to approve their own tasks
  if (data.status === 'Approved' && isEmployee && task.assignedToId !== session.user.id) {
    throw new Error('You can only approve tasks assigned to you')
  }

  const validated = updateTaskSchema.parse(data)
  
  // If taskType is being updated, recalculate dueDate
  let updateData: any = { ...validated }
  if (data.taskType !== undefined) {
    if (data.taskType) {
      const template = await prisma.taskTemplate.findUnique({
        where: { taskType: data.taskType },
        select: { durationHours: true, isActive: true },
      })
      
      if (!template) {
        throw new Error(`Task template not found for type: ${data.taskType}`)
      }
      
      if (!template.isActive) {
        throw new Error(`Task template is inactive for type: ${data.taskType}`)
      }
      
      // Use existing startDate or current time
      const startDate = task.startDate || new Date()
      const dueDate = new Date(startDate.getTime() + template.durationHours * 60 * 60 * 1000)
      
      updateData.startDate = startDate
      updateData.dueDate = dueDate
    } else {
      // If taskType is cleared, allow manual dueDate
      updateData.startDate = null
    }
  }
  
  const updatedTask = await prisma.task.update({
    where: { id },
    data: updateData,
    include: {
      User_Task_assignedByIdToUser: {
        select: { name: true },
      },
      User_Task_assignedToIdToUser: {
        select: { id: true, name: true, phoneNumber: true, notifyTaskUpdates: true },
      },
      Client: {
        select: { name: true },
      },
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'Task', updatedTask.id)

  // Send WhatsApp notification if task assignment changed to a new employee
  if (data.assignedToId !== undefined && data.assignedToId && data.assignedToId !== task.assignedToId) {
    const assignedToUser = updatedTask.User_Task_assignedToIdToUser
    
    if (assignedToUser) {
      console.log(`[WhatsApp] Task reassigned to user: ${assignedToUser.name} (${assignedToUser.id})`)
      console.log(`[WhatsApp] Phone number: ${assignedToUser.phoneNumber || 'NOT SET'}`)
      console.log(`[WhatsApp] Notify task updates: ${assignedToUser.notifyTaskUpdates}`)
      
      // Only send if user has phone number and notifications enabled
      if (!assignedToUser.phoneNumber) {
        console.warn(`[WhatsApp] Skipping notification: User ${assignedToUser.name} does not have a phone number`)
      } else if (!assignedToUser.notifyTaskUpdates) {
        console.warn(`[WhatsApp] Skipping notification: User ${assignedToUser.name} has task notifications disabled`)
      } else {
      try {
        const message = formatTaskAssignmentMessage(
          updatedTask.title,
          updatedTask.User_Task_assignedByIdToUser.name,
          updatedTask.priority,
          updatedTask.dueDate || undefined,
          updatedTask.Client?.name
        )

        // Get template variables for template-based messages
        const templateVariables = getTaskAssignmentTemplateVariables(
          updatedTask.title,
          updatedTask.User_Task_assignedByIdToUser.name,
          updatedTask.priority,
          updatedTask.dueDate || undefined,
          updatedTask.Client?.name
        )

        console.log(`[WhatsApp] Attempting to send notification to ${assignedToUser.phoneNumber}`)
        const result = await sendWhatsAppNotification(assignedToUser.phoneNumber, message, templateVariables)
          
          if (result.success) {
            console.log(`[WhatsApp] ✅ Notification sent successfully. Message ID: ${result.messageId || 'N/A'}`)
          } else {
            console.error(`[WhatsApp] ❌ Failed to send notification: ${result.error}`)
            // Don't throw error - task update should succeed even if notification fails
          }
        } catch (error) {
          console.error('[WhatsApp] ❌ Error sending WhatsApp notification:', error)
          // Don't throw error - task update should succeed even if notification fails
        }
      }
    } else {
      console.warn('[WhatsApp] Assigned user not found, skipping notification')
    }
  }

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

  const userRole = session.user.role as UserRole
  const isEmployee = userRole === UserRole.EMPLOYEE

  // Employees can only update tasks assigned to them
  if (isEmployee && task.assignedToId !== session.user.id) {
    throw new Error('You can only update tasks assigned to you')
  }

  // Check if user can approve/reject
  // Employees can approve their own tasks, but cannot reject them
  if (data.status === 'Rejected') {
    if (!canApproveTasks(userRole)) {
      throw new Error('Only admins can reject tasks')
    }
    if (!data.rejectionFeedback) {
      throw new Error('Rejection feedback is required when rejecting a task')
    }
  }

  // Employees can approve their own tasks, but cannot reject them
  if (isEmployee && data.status === 'Rejected') {
    throw new Error('Employees cannot reject tasks')
  }

  // Allow employees to approve their own tasks
  if (isEmployee && data.status === 'Approved' && task.assignedToId !== session.user.id) {
    throw new Error('You can only approve tasks assigned to you')
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

export async function deleteTasks(ids: string[]) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageTasks(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  if (!ids || ids.length === 0) {
    throw new Error('No tasks selected')
  }

  // Delete all tasks in a transaction
  await prisma.$transaction(
    ids.map(id =>
      prisma.task.delete({
        where: { id },
      })
    )
  )

  // Log activity for bulk delete
  await logActivity(session.user.id, 'DELETE', 'Task', `Bulk delete: ${ids.length} tasks`)

  return { success: true, deletedCount: ids.length }
}

