'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { canManageTasks, canApproveTasks } from '@/lib/rbac'
import { UserRole, TaskStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { isBeforeIstToday, normalizeTaskDueDate } from '@/lib/attendance-config'
import { advanceWorkflow } from '@/lib/automation'
import { notifyTaskAssignment } from '@/lib/notification-service'

// Helper function to handle task dependencies - creates/assigns next task when a task is completed
async function handleTaskDependencies(completedTaskId: string, clientId: string | null, clientName: string, doctorOrHospitalName: string, assignedById: string) {
  if (!clientId) return // Only handle tasks with clients

  const completedTask = await prisma.task.findUnique({
    where: { id: completedTaskId },
    select: { title: true, clientId: true },
  })

  if (!completedTask) return

  // Only move forward in the workflow if the client actually requested that content type.
  const marketing = await prisma.client_marketing_requirements.findUnique({
    where: { clientId },
    select: { posters: true, videos: true },
  })
  const hasPosters = marketing?.posters ?? false
  const hasVideos = marketing?.videos ?? false

  // Extract task name from task title (format: "Task Name for ClientName")
  const titleMatch = completedTask.title.match(/^(.+?)\s+for\s+(.+)$/i)
  if (!titleMatch) return

  const taskName = titleMatch[1].trim()
  // Use the passed clientName parameter instead of extracting from title for consistency

  // Find users by name (case-insensitive)
  const [gowthami, shaheena, raghu, chaithanya, rohith] = await Promise.all([
    prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { contains: 'Gowthami', mode: 'insensitive' } },
          { name: { contains: 'Gouthami', mode: 'insensitive' } },
        ],
      },
    }),
    prisma.user.findFirst({
      where: { name: { contains: 'Shaheena', mode: 'insensitive' }, isActive: true },
    }),
    prisma.user.findFirst({
      where: { name: { contains: 'Raghu', mode: 'insensitive' }, isActive: true },
    }),
    prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { contains: 'Chaithanya', mode: 'insensitive' } },
          { name: { contains: 'Chaitanya', mode: 'insensitive' } },
        ],
      },
    }),
    prisma.user.findFirst({
      where: { name: { contains: 'Rohith', mode: 'insensitive' }, isActive: true },
    }),
  ])

  let nextTaskTitle: string | null = null
  let nextTaskAssignee: typeof gowthami | null = null

  // Define task dependencies
  if (taskName === 'Content Calendar') {
    if (!hasPosters) return
    // Content Calendar completed → assign Poster design to Chaithanya
    nextTaskTitle = `Poster design for ${clientName}`
    nextTaskAssignee = chaithanya
  } else if (taskName === 'Video content') {
    if (!hasVideos) return
    // Video content completed → create Video editing for Rohith
    nextTaskTitle = `Video editing for ${clientName}`
    nextTaskAssignee = rohith
  } else if (taskName === 'Video editing') {
    if (!hasVideos) return
    // Video editing completed → assign Scheduling the videos to Gowthami
    nextTaskTitle = `Scheduling the videos for ${clientName}`
    nextTaskAssignee = gowthami
  } else if (taskName === 'Website content') {
    // Website content completed → assign Web development to Raghu
    nextTaskTitle = `Web development for ${clientName}`
    nextTaskAssignee = raghu
  } else if (taskName === 'Poster design') {
    if (!hasPosters) return
    // Poster design completed → create Scheduling the posters for Gowthami
    nextTaskTitle = `Scheduling the posters for ${clientName}`
    nextTaskAssignee = gowthami
  }

  if (!nextTaskTitle || !nextTaskAssignee) return

  // Check if the next task already exists
  const existingTask = await prisma.task.findFirst({
    where: {
      clientId,
      title: nextTaskTitle,
    },
  })

  if (existingTask) {
    // If task exists but not assigned, assign it now
    if (!existingTask.assignedToId) {
      const assignedAt = new Date()
      await prisma.$transaction(async (tx) => {
        await tx.task.update({
          where: { id: existingTask.id },
          data: { assignedToId: nextTaskAssignee.id, assignedById },
        })
        await notifyTaskAssignment(tx, {
          taskId: existingTask.id,
          title: existingTask.title,
          actorId: assignedById,
          actorName: 'Workflow',
          previousAssigneeId: null,
          nextAssigneeId: nextTaskAssignee.id,
          nextAssigneeName: nextTaskAssignee.name,
          clientName,
          assignedAt,
        })
      })
      await logActivity(assignedById, 'UPDATE', 'Task', existingTask.id)
      console.log(`Auto-assigned existing task "${nextTaskTitle}" to ${nextTaskAssignee.name}`)
    }
  } else {
    const assignedAt = new Date()
    const newTask = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          id: randomUUID(),
          title: nextTaskTitle,
          description: `${nextTaskTitle.replace(` for ${clientName}`, '')} task for ${doctorOrHospitalName}`,
          priority: 'Medium' as const,
          status: 'Pending' as const,
          assignedById,
          assignedToId: nextTaskAssignee.id,
          clientId,
          startDate: assignedAt,
        },
      })
      await notifyTaskAssignment(tx, {
        taskId: created.id,
        title: created.title,
        actorId: assignedById,
        actorName: 'Workflow',
        nextAssigneeId: nextTaskAssignee.id,
        nextAssigneeName: nextTaskAssignee.name,
        clientName,
        priority: 'Medium',
        assignedAt,
      })
      return created
    })
    await logActivity(assignedById, 'CREATE', 'Task', newTask.id)
    console.log(`Auto-created and assigned task "${nextTaskTitle}" to ${nextTaskAssignee.name}`)
  }
}

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
      select: { id: true, status: true },
    })
    if (!client) {
      throw new Error('Client not found')
    }
    if (client.status === 'PAUSED') {
      throw new Error('Cannot assign a task to a paused client')
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
    // Ensure the result is at end of business day (6 PM) if it's a full day calculation
    const calculatedDate = new Date(startDate.getTime() + template.durationHours * 60 * 60 * 1000)
    dueDate = normalizeTaskDueDate(startDate, calculatedDate, template.durationHours)
  } else if (validated.dueDate) {
    dueDate = normalizeTaskDueDate(startDate, new Date(validated.dueDate))
  }

  if (dueDate && isBeforeIstToday(dueDate)) {
    throw new Error('Due date cannot be in the past')
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
  
  const assignedAt = new Date()
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: taskData,
      include: {
        User_Task_assignedByIdToUser: {
          select: { name: true },
        },
        User_Task_assignedToIdToUser: {
          select: { id: true, name: true },
        },
        Client: {
          select: { name: true },
        },
      },
    })
    await notifyTaskAssignment(tx, {
      taskId: created.id,
      title: created.title,
      actorId: userId,
      actorName: session.user.name || 'Someone',
      nextAssigneeId: created.assignedToId,
      nextAssigneeName: created.User_Task_assignedToIdToUser?.name,
      clientName: created.Client?.name,
      priority: created.priority,
      assignedAt,
    })
    return created
  })

  await logActivity(userId, 'CREATE', 'Task', task.id)

  // Revalidate paths to refresh UI
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath(`/tasks/${task.id}`)

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

  if (data.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true, status: true },
    })
    if (!client) throw new Error('Client not found')
    if (client.status === 'PAUSED' && data.clientId !== task.clientId) {
      throw new Error('Cannot assign a task to a paused client')
    }
  }

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
  const canManage = canManageTasks(userRole)
  const isTaskCreator = task.assignedById === session.user.id

  // Check if user has permission to edit this task
  // Employees can only edit tasks they created (assignedById === userId)
  // Admins can edit any task
  if (isEmployee && !isTaskCreator) {
    throw new Error('You can only edit tasks that you created')
  }

  // Employees cannot change status through edit - they must use status update
  if (isEmployee && data.status !== undefined && data.status !== task.status) {
    throw new Error('You cannot change task status through edit. Use the status update button instead.')
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
      const calculatedDate = new Date(startDate.getTime() + template.durationHours * 60 * 60 * 1000)
      // If duration results in a date (not just hours), set to end of business day
      if (template.durationHours >= 24 || calculatedDate.getDate() !== startDate.getDate()) {
        calculatedDate.setHours(18, 0, 0, 0) // 6:00 PM
      }
      const dueDate = calculatedDate
      
      updateData.startDate = startDate
      updateData.dueDate = dueDate
    } else {
      // If taskType is cleared, allow manual dueDate
      updateData.startDate = null
    }
  }
  
  const nextAssigneeId = updateData.assignedToId === undefined ? task.assignedToId : updateData.assignedToId
  const assigneeChanged = (nextAssigneeId || null) !== (task.assignedToId || null)
  const assignedAt = new Date()
  const updatedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: updateData,
      include: {
        User_Task_assignedByIdToUser: {
          select: { name: true },
        },
        User_Task_assignedToIdToUser: {
          select: { id: true, name: true },
        },
        Client: {
          select: { name: true },
        },
      },
    })
    if (assigneeChanged) {
      await notifyTaskAssignment(tx, {
        taskId: updated.id,
        title: updated.title,
        actorId: session.user.id,
        actorName: session.user.name || 'Someone',
        previousAssigneeId: task.assignedToId,
        nextAssigneeId: updated.assignedToId,
        nextAssigneeName: updated.User_Task_assignedToIdToUser?.name,
        clientName: updated.Client?.name,
        priority: updated.priority,
        assignedAt,
      })
    }
    return updated
  })

  await logActivity(session.user.id, 'UPDATE', 'Task', updatedTask.id)

  // Revalidate paths to refresh UI
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath(`/tasks/${id}`)

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
  if (task.templateid) throw new Error('Scheduled tasks are updated from My Day')

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
    include: {
      Client: {
        select: { name: true, doctorOrHospitalName: true },
      },
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'Task', updatedTask.id)

  // Handle task dependencies when a task is approved (completed)
  if (data.status === 'Approved' && updatedTask.clientId && updatedTask.Client) {
    try {
      await handleTaskDependencies(
        updatedTask.id,
        updatedTask.clientId,
        updatedTask.Client.name,
        updatedTask.Client.doctorOrHospitalName || updatedTask.Client.name,
        session.user.id
      )
    } catch (error) {
      // Log error but don't fail the status update
      console.error('Error handling task dependencies:', error)
    }
    try {
      await advanceWorkflow({
        id: updatedTask.id,
        clientId: updatedTask.clientId,
        assignedById: session.user.id,
        workflowtemplateid: updatedTask.workflowtemplateid,
        workflowrunid: updatedTask.workflowrunid,
        stageorder: updatedTask.stageorder,
      })
    } catch (error) {
      console.error('Error advancing workflow:', error)
    }
  }

  // Revalidate paths to refresh UI
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath(`/tasks/${id}`)

  return updatedTask
}

function canDeleteOwnTask(role: UserRole): boolean {
  return role === UserRole.EMPLOYEE || role === UserRole.MANAGER
}

async function assertCanDeleteTasks(userId: string, role: UserRole, ids: string[]) {
  if (canManageTasks(role)) return

  if (!canDeleteOwnTask(role)) {
    throw new Error('You can only delete tasks that you created')
  }

  const owned = await prisma.task.findMany({
    where: { id: { in: ids }, assignedById: userId },
    select: { id: true },
  })

  if (owned.length !== ids.length) {
    throw new Error('You can only delete tasks that you created')
  }
}

export async function deleteTask(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  await assertCanDeleteTasks(session.user.id, session.user.role as UserRole, [id])

  await prisma.task.delete({
    where: { id },
  })

  await logActivity(session.user.id, 'DELETE', 'Task', id)

  // Revalidate paths to refresh UI
  revalidatePath('/tasks')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function deleteTasks(ids: string[]) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!ids || ids.length === 0) {
    throw new Error('No tasks selected')
  }

  await assertCanDeleteTasks(session.user.id, session.user.role as UserRole, ids)

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

  // Revalidate paths to refresh UI
  revalidatePath('/tasks')
  revalidatePath('/dashboard')

  return { success: true, deletedCount: ids.length }
}

