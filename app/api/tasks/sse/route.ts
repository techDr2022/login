export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

// SSE endpoint for real-time task notifications
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id
  const userRole = session.user.role as UserRole

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
          const where: any = {}
          
          // Employees only see tasks assigned to them
          if (userRole === UserRole.EMPLOYEE) {
            where.assignedToId = userId
          }
          // Managers and Super Admins see all tasks
          // (no filter needed)

          // Check for new tasks created after lastCheck
          const newTasks = await prisma.task.findMany({
            where: {
              ...where,
              createdAt: { gt: lastCheck },
            },
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
            // 2. User is a manager or super admin (they see all tasks created by others)
            if (task.assignedToId === userId) {
              return true
            }
            if (userRole === UserRole.MANAGER || userRole === UserRole.SUPER_ADMIN) {
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

