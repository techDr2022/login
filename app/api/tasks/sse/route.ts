export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes to match vercel.json config

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
          // If controller is closed, mark as closed
          if (error instanceof Error && error.message.includes('closed')) {
            isClosed = true
          }
        }
      }

      // Send initial connection message
      sendEvent({ type: 'connected', userId })
      console.log(`[SSE] User ${userId} connected to task notifications`)

      // Track last known task statuses for detecting changes
      const taskStatusMap = new Map<string, string>()
      
      // Initialize task status map with user-specific filtering
      try {
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
        console.log(`[SSE] Initialized with ${initialTasks.length} tasks for user ${userId}`)
      } catch (error) {
        console.error('[SSE] Error initializing task status map:', error)
        sendEvent({ type: 'error', message: 'Failed to initialize task status map' })
      }

      // Send heartbeat every 30 seconds to keep connection alive and detect disconnects faster
      const heartbeatInterval = setInterval(() => {
        if (!isClosed) {
          sendEvent({ type: 'heartbeat', timestamp: new Date().toISOString() })
        }
      }, 30000)

      // Poll for new tasks every 1.5 seconds for better real-time responsiveness
      let lastCheck = new Date(Date.now() - 2000) // Start 2 seconds back to catch recent changes
      let lastTaskCount = 0
      let consecutiveErrors = 0
      const MAX_CONSECUTIVE_ERRORS = 5
      
      const pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval)
          return
        }

        try {
          consecutiveErrors = 0 // Reset on success
          const now = new Date()
          // Use a slightly earlier timestamp to ensure we don't miss any tasks
          const checkFrom = new Date(lastCheck.getTime() - 1000) // Check 1 second before last check
          
          // Build query based on user role
          const where: any = {
            createdAt: { gt: checkFrom },
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

          // Check for status changes - use same checkFrom timestamp
          const recentTaskUpdates = await prisma.activity_logs.findMany({
            where: {
              entityType: 'Task',
              action: 'UPDATE',
              timestamp: { gt: checkFrom },
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

          lastCheck = now
        } catch (error) {
          consecutiveErrors++
          console.error(`[SSE] Error in task SSE poll (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error)
          
          // If too many consecutive errors, close the connection
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error('[SSE] Too many consecutive errors, closing connection')
            cleanup()
            return
          }
          
          // Send error event to client (but don't close connection)
          if (!isClosed) {
            try {
              sendEvent({ 
                type: 'error', 
                message: 'Error polling for tasks',
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            } catch (sendError) {
              // If we can't send error, connection is likely dead
              console.error('[SSE] Cannot send error event, closing connection')
              cleanup()
            }
          }
        }
      }, 1500) // Poll every 1.5 seconds for better real-time responsiveness

      // Cleanup function
      let timeout: NodeJS.Timeout | null = null
      const cleanup = () => {
        if (isClosed) return
        isClosed = true
        console.log(`[SSE] Cleaning up connection for user ${userId}`)
        clearInterval(pollInterval)
        clearInterval(heartbeatInterval)
        if (timeout) {
          clearTimeout(timeout)
        }
        try {
          controller.close()
        } catch (error) {
          // Ignore errors on close
          console.error('[SSE] Error closing controller:', error)
        }
      }

      // Handle client disconnect
      if (request.signal) {
        request.signal.addEventListener('abort', cleanup)
      }

      // Also set a timeout to close after 5 minutes of inactivity (increased for better stability)
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

