export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { canViewAllTasks } from '@/lib/rbac'

// SSE endpoint for real-time task notifications
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id
  const userRole = session.user.role as UserRole
  const canViewAll = canViewAllTasks(userRole)

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false

      const sendEvent = (data: any) => {
        if (isClosed) return
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch (error) {
          console.error('Error sending SSE event:', error)
        }
      }

      // Send initial connection message
      sendEvent({ type: 'connected', userId })

      // Track last known task statuses for detecting changes
      const taskStatusMap = new Map<string, string>()
      
      // Initialize task status map with user-specific filtering
      const initialTasksWhere: any = {}
      if (!canViewAll && userId) {
        initialTasksWhere.OR = [
          { assignedToId: userId },
          { assignedById: userId },
        ]
      }
      
      const initialTasks = await prisma.task.findMany({
        where: initialTasksWhere,
        select: { id: true, status: true },
        take: 100, // Track up to 100 most recent tasks
      })
      initialTasks.forEach((task) => {
        taskStatusMap.set(task.id, task.status)
      })

      // Poll for new tasks every 2 seconds
      let lastCheck = new Date()
      let lastTaskCount = 0
      const pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval)
          return
        }

        try {
          // Build query based on user role
          const where: any = {
            createdAt: { gt: lastCheck },
          }
          
          // For non-admin users, only show tasks assigned to them or assigned by them
          if (!canViewAll && userId) {
            where.OR = [
              { assignedToId: userId },
              { assignedById: userId },
            ]
          }

          // Check for new tasks created after lastCheck
          const newTasks = await prisma.task.findMany({
            where,
            include: {
              User_Task_assignedByIdToUser: {
                select: { id: true, name: true, email: true },
              },
              User_Task_assignedToIdToUser: {
                select: { id: true, name: true, email: true },
              },
              Client: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          })

          // Filter tasks that should notify this user
          const tasksToNotify = newTasks.filter((task) => {
            // Don't notify if user created the task themselves
            if (task.assignedById === userId) {
              return false
            }
            
            // Notify if:
            // 1. Task is assigned to this user
            // 2. User is a super admin (they see all tasks created by others)
            if (task.assignedToId === userId) {
              return true
            }
            if (canViewAll) {
              return true
            }
            return false
          })

          if (tasksToNotify.length > 0) {
            for (const task of tasksToNotify) {
              sendEvent({
                type: 'new_task',
                task: {
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  status: task.status,
                  assignedToId: task.assignedToId,
                  assignedById: task.assignedById,
                  clientId: task.clientId,
                  dueDate: task.dueDate,
                  createdAt: task.createdAt,
                  assignedTo: task.User_Task_assignedToIdToUser
                    ? {
                        id: task.User_Task_assignedToIdToUser.id,
                        name: task.User_Task_assignedToIdToUser.name,
                        email: task.User_Task_assignedToIdToUser.email,
                      }
                    : null,
                  assignedBy: task.User_Task_assignedByIdToUser
                    ? {
                        id: task.User_Task_assignedByIdToUser.id,
                        name: task.User_Task_assignedByIdToUser.name,
                        email: task.User_Task_assignedByIdToUser.email,
                      }
                    : null,
                  client: task.Client
                    ? {
                        id: task.Client.id,
                        name: task.Client.name,
                      }
                    : null,
                },
              })
            }
          }

          // Check for unread task notifications count
          // Count tasks assigned to user that are pending or in progress
          const unreadTasksCount = await prisma.task.count({
            where: {
              assignedToId: userId,
              status: { in: ['Pending', 'InProgress'] },
            },
          })

          if (unreadTasksCount !== lastTaskCount) {
            sendEvent({ type: 'task_count_update', count: unreadTasksCount })
            lastTaskCount = unreadTasksCount
          }

          // Check for status changes
          const recentTaskUpdates = await prisma.activity_logs.findMany({
            where: {
              entityType: 'Task',
              action: 'UPDATE',
              timestamp: { gt: lastCheck },
            },
            include: {
              User: {
                select: { id: true, name: true },
              },
            },
            orderBy: { timestamp: 'desc' },
            take: 10,
          })

          // Check each updated task for status changes
          for (const update of recentTaskUpdates) {
            const task = await prisma.task.findUnique({
              where: { id: update.entityId },
              include: {
                User_Task_assignedToIdToUser: {
                  select: { id: true, name: true, email: true },
                },
                User_Task_assignedByIdToUser: {
                  select: { id: true, name: true, email: true },
                },
              },
            })

            // Check if user has access to this task
            if (task && (canViewAll || task.assignedToId === userId || task.assignedById === userId)) {
              const oldStatus = taskStatusMap.get(task.id)
              const newStatus = task.status

              // If status changed, send event
              if (oldStatus && oldStatus !== newStatus) {
                // Check if task was completed by the assigned person
                // Task is considered "completed" when status changes to Review or Approved
                const isCompleted = (newStatus === 'Review' || newStatus === 'Approved') && 
                                    (oldStatus !== 'Review' && oldStatus !== 'Approved')
                const completedByAssignedPerson = isCompleted && 
                                                   task.assignedToId && 
                                                   task.assignedToId === update.userId &&
                                                   task.assignedById !== update.userId

                if (completedByAssignedPerson && task.assignedById === userId) {
                  // Notify the assigner that the task has been completed
                  sendEvent({
                    type: 'task_completed',
                    task: {
                      id: task.id,
                      title: task.title,
                      status: newStatus,
                      completedBy: {
                        id: task.assignedToId,
                        name: task.User_Task_assignedToIdToUser?.name || 'Unknown',
                        email: task.User_Task_assignedToIdToUser?.email || '',
                      },
                      assignedBy: {
                        id: task.assignedById,
                        name: task.User_Task_assignedByIdToUser?.name || 'Unknown',
                        email: task.User_Task_assignedByIdToUser?.email || '',
                      },
                      timestamp: update.timestamp.toISOString(),
                    },
                  })
                }

                sendEvent({
                  type: 'status_change',
                  statusChange: {
                    id: update.id,
                    taskId: task.id,
                    taskTitle: task.title,
                    oldStatus,
                    newStatus,
                    changedBy: update.userId,
                    changedByName: update.User.name,
                    timestamp: update.timestamp.toISOString(),
                  },
                })
              }

              // Update status map
              taskStatusMap.set(task.id, newStatus)
            }
          }

          // Also send task_update event for any task changes
          if (recentTaskUpdates.length > 0) {
            const updatedTaskIds = [...new Set(recentTaskUpdates.map((u) => u.entityId))]
            const updatedTasksWhere: any = { id: { in: updatedTaskIds } }
            if (!canViewAll && userId) {
              updatedTasksWhere.AND = [
                { id: { in: updatedTaskIds } },
                {
                  OR: [
                    { assignedToId: userId },
                    { assignedById: userId },
                  ]
                }
              ]
            }
            
            const updatedTasks = await prisma.task.findMany({
              where: updatedTasksWhere,
              include: {
                User_Task_assignedByIdToUser: {
                  select: { id: true, name: true, email: true },
                },
                User_Task_assignedToIdToUser: {
                  select: { id: true, name: true, email: true },
                },
                Client: {
                  select: { id: true, name: true },
                },
              },
            })

            for (const task of updatedTasks) {
              sendEvent({
                type: 'task_update',
                task: {
                  id: task.id,
                  title: task.title,
                  status: task.status,
                  assignedTo: task.User_Task_assignedToIdToUser,
                  assignedBy: task.User_Task_assignedByIdToUser,
                  client: task.Client,
                },
              })
            }
          }

          lastCheck = new Date()
        } catch (error) {
          console.error('Error in task SSE poll:', error)
        }
      }, 2000)

      // Cleanup function
      let timeout: NodeJS.Timeout | null = null
      const cleanup = () => {
        isClosed = true
        clearInterval(pollInterval)
        if (timeout) {
          clearTimeout(timeout)
        }
        try {
          controller.close()
        } catch (error) {
          // Ignore errors on close
        }
      }

      // Handle client disconnect
      if (request.signal) {
        request.signal.addEventListener('abort', cleanup)
      }

      // Also set a timeout to close after 5 minutes of inactivity
      timeout = setTimeout(cleanup, 5 * 60 * 1000)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  })
}

