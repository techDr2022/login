import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ChatThreadType, UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'

let io: SocketIOServer | null = null

export function initializeSocketIO(httpServer: HTTPServer) {
  if (io) {
    return io
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth?.userId
      if (!userId) {
        return next(new Error('Authentication error'))
      }

      // Verify user exists and is active
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true },
      })

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'))
      }

      socket.data.userId = userId
      next()
    } catch (error) {
      console.error('Socket authentication error:', error)
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string
    console.log(`User ${userId} connected: ${socket.id}`)

    // Mark user as online
    socket.broadcast.emit('user-online', { userId })

    // Get user's accessible threads
    const threads = await getUserThreads(userId)
    const threadIds = threads.map((t) => t.id)

    // Join user to their threads
    for (const threadId of threadIds) {
      socket.join(`thread:${threadId}`)
    }

    // Send online users list
    const onlineUsers = Array.from(io!.sockets.sockets.values())
      .map((s) => s.data.userId)
      .filter((id): id is string => !!id && id !== userId)
    socket.emit('online-users', { userIds: onlineUsers })

    // Join room
    socket.on('join-room', async ({ threadId }: { threadId: string }) => {
      // Verify user has access
      const hasAccess = await verifyThreadAccess(userId, threadId)
      if (hasAccess) {
        socket.join(`thread:${threadId}`)
        console.log(`User ${userId} joined thread ${threadId}`)
      }
    })

    // Leave room
    socket.on('leave-room', ({ threadId }: { threadId: string }) => {
      socket.leave(`thread:${threadId}`)
      console.log(`User ${userId} left thread ${threadId}`)
    })

    // Send message
    socket.on('send-message', async ({ threadId, content }: { threadId: string; content: string }) => {
      try {
        // Verify access
        const hasAccess = await verifyThreadAccess(userId, threadId)
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' })
          return
        }

        // Create message in database
        const message = await prisma.chat_messages.create({
          data: {
            id: randomUUID(),
            threadId,
            senderId: userId,
            message: content,
          },
          include: {
            User: { select: { id: true, name: true, email: true, role: true } },
          },
        })

        // Emit message immediately so users see it right away
        const messageData = {
          id: message.id,
          threadId: message.threadId,
          senderId: message.senderId,
          sender: message.User,
          content: message.message,
          createdAt: message.createdAt.toISOString(),
          seenBy: [],
        }

        io!.to(`thread:${threadId}`).emit('receive-message', messageData)

        // Update unread counts in parallel (non-blocking, but we still await to ensure completion)
        // Get thread participants
        const thread = await prisma.chat_threads.findUnique({
          where: { id: threadId },
        })

        if (!thread) return

        let participants: string[] = []

        if (thread.type === ChatThreadType.TEAM) {
          const allUsers = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true },
          })
          participants = allUsers.map((u) => u.id)
        } else if (thread.type === ChatThreadType.DIRECT) {
          if (thread.user1Id) participants.push(thread.user1Id)
          if (thread.user2Id) participants.push(thread.user2Id)
        }

        // Update unread counts for recipients - use parallel batch operations
        const recipients = participants.filter((id) => id !== userId)
        if (recipients.length > 0) {
          // Execute all upserts in parallel for maximum performance
          // Using Promise.allSettled to ensure all operations complete even if some fail
          // Don't await this so message delivery isn't blocked, but errors are logged
          Promise.allSettled(
            recipients.map((recipientId) =>
              prisma.chat_unread_counts.upsert({
                where: {
                  threadId_userId: {
                    threadId,
                    userId: recipientId,
                  },
                },
                update: {
                  count: { increment: 1 },
                },
                create: {
                  id: randomUUID(),
                  threadId,
                  userId: recipientId,
                  count: 1,
                },
              })
            )
          ).catch((error) => {
            console.error('Error updating unread counts:', error)
            // Don't throw - unread counts can be updated later, message is already sent
          })
        }
      } catch (error) {
        console.error('Error sending message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Typing indicator
    socket.on('typing', ({ threadId }: { threadId: string }) => {
      const user = io!.sockets.sockets.get(socket.id)?.data
      if (user) {
        socket.to(`thread:${threadId}`).emit('typing', {
          threadId,
          userId,
          userName: user.name || 'Someone',
        })
      }
    })

    socket.on('stop-typing', ({ threadId }: { threadId: string }) => {
      socket.to(`thread:${threadId}`).emit('stop-typing', {
        threadId,
        userId,
      })
    })

    // Message seen
    socket.on('message-seen', async ({ threadId, messageId }: { threadId: string; messageId: string }) => {
      try {
        // Verify access
        const hasAccess = await verifyThreadAccess(userId, threadId)
        if (!hasAccess) return

        // Emit to other users in thread
        socket.to(`thread:${threadId}`).emit('message-seen', {
          messageId,
          threadId,
          userId,
        })

        // TODO: Update database with seen status if needed
      } catch (error) {
        console.error('Error marking message as seen:', error)
      }
    })

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected: ${socket.id}`)
      socket.broadcast.emit('user-offline', { userId })
    })
  })

  return io
}

export function getIO(): SocketIOServer | null {
  return io
}

async function getUserThreads(userId: string) {
  const userRole = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!userRole) return []

  // Get TEAM thread
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

  const threads = [teamThread]

  // Get DIRECT threads
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

  // Filter DIRECT threads based on role
  for (const thread of directThreads) {
    const hasSuperAdmin =
      userRole.role === UserRole.SUPER_ADMIN ||
      thread.User_chat_threads_user1IdToUser?.role === UserRole.SUPER_ADMIN ||
      thread.User_chat_threads_user2IdToUser?.role === UserRole.SUPER_ADMIN

    if (hasSuperAdmin) {
      threads.push({ id: thread.id })
    }
  }

  return threads
}

async function verifyThreadAccess(userId: string, threadId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user) return false

  const thread = await prisma.chat_threads.findUnique({
    where: { id: threadId },
    include: {
      User_chat_threads_user1IdToUser: { select: { role: true } },
      User_chat_threads_user2IdToUser: { select: { role: true } },
    },
  })

  if (!thread) return false

  if (thread.type === ChatThreadType.TEAM) {
    return true // Everyone can access TEAM thread
  }

  if (thread.type === ChatThreadType.DIRECT) {
    // Check if user is participant
    const isParticipant = thread.user1Id === userId || thread.user2Id === userId
    if (!isParticipant) return false

    // Check if thread has SUPER_ADMIN
    const hasSuperAdmin =
      user.role === UserRole.SUPER_ADMIN ||
      thread.User_chat_threads_user1IdToUser?.role === UserRole.SUPER_ADMIN ||
      thread.User_chat_threads_user2IdToUser?.role === UserRole.SUPER_ADMIN

    return hasSuperAdmin
  }

  return false
}

