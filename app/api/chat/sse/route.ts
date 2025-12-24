export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { ChatThreadType, UserRole } from '@prisma/client'

// SSE endpoint for real-time updates
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

      // Poll for new messages every 2 seconds
      let lastCheck = new Date()
      let lastUnreadCount = 0
      const pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval)
          return
        }

        try {
          // Get threads user has access to - create team thread if doesn't exist
          let teamThread = await prisma.chat_threads.findFirst({
            where: { type: ChatThreadType.TEAM },
            select: { id: true },
          })

          if (!teamThread) {
            teamThread = await prisma.chat_threads.create({
              data: { id: randomUUID(), type: ChatThreadType.TEAM },
              select: { id: true },
            })
          }

          const directThreads = await prisma.chat_threads.findMany({
            where: {
              type: ChatThreadType.DIRECT,
              OR: [{ user1Id: userId }, { user2Id: userId }],
            },
            include: {
              User_chat_threads_user1IdToUser: { select: { role: true } },
              User_chat_threads_user2IdToUser: { select: { role: true } },
            },
          })

          const accessibleThreadIds: string[] = []
          if (teamThread) accessibleThreadIds.push(teamThread.id)

          for (const thread of directThreads) {
            const hasManagerOrSuperAdmin =
              userRole === UserRole.MANAGER ||
              userRole === UserRole.SUPER_ADMIN ||
              thread.User_chat_threads_user1IdToUser?.role === UserRole.MANAGER ||
              thread.User_chat_threads_user1IdToUser?.role === UserRole.SUPER_ADMIN ||
              thread.User_chat_threads_user2IdToUser?.role === UserRole.MANAGER ||
              thread.User_chat_threads_user2IdToUser?.role === UserRole.SUPER_ADMIN

            if (hasManagerOrSuperAdmin) {
              accessibleThreadIds.push(thread.id)
            }
          }

          // Check for new messages
          const newMessages = await prisma.chat_messages.findMany({
            where: {
              threadId: { in: accessibleThreadIds },
              senderId: { not: userId },
              createdAt: { gt: lastCheck },
            },
            include: {
              User: { select: { id: true, name: true, email: true, role: true } },
              chat_threads: { select: { id: true, type: true } },
            },
            orderBy: { createdAt: 'asc' },
          })

          if (newMessages.length > 0) {
            for (const message of newMessages) {
              sendEvent({
                type: 'new_message',
                message: {
                  id: message.id,
                  threadId: message.threadId,
                  message: message.message,
                  sender: message.User,
                  createdAt: message.createdAt,
                },
              })
            }
          }

          // Check for unread count updates (only send if changed)
          const unreadCounts = await prisma.chat_unread_counts.findMany({
            where: {
              userId,
              threadId: { in: accessibleThreadIds },
            },
          })

          const totalUnread = unreadCounts.reduce((sum, uc) => sum + uc.count, 0)
          if (totalUnread !== lastUnreadCount) {
            sendEvent({ type: 'unread_update', totalUnread })
            lastUnreadCount = totalUnread
          }

          lastCheck = new Date()
        } catch (error) {
          console.error('Error in SSE poll:', error)
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

