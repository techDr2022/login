export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { UserRole, ChatThreadType } from '@prisma/client'
import { sendMessageSchema } from '@/lib/validations'

// GET /api/chat/threads/[id]/messages - Get messages for a thread
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await context.params

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role as UserRole

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 })
    }

    // Verify access to thread
    let thread = await prisma.chat_threads.findUnique({
      where: { id: threadId },
      include: {
        User_chat_threads_user1IdToUser: { select: { role: true } },
        User_chat_threads_user2IdToUser: { select: { role: true } },
      },
    })

    // If thread not found and it's a TEAM thread request, try to find/create team thread
    if (!thread) {
      // Check if this might be a team thread ID issue - try to get the actual team thread
      const teamThread = await prisma.chat_threads.findFirst({
        where: { type: ChatThreadType.TEAM },
        include: {
          User_chat_threads_user1IdToUser: { select: { role: true } },
          User_chat_threads_user2IdToUser: { select: { role: true } },
        },
      })
      
      if (teamThread && teamThread.id === threadId) {
        thread = teamThread
      } else {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
      }
    }

    // Access control: TEAM thread - any authenticated user
    if (thread.type === ChatThreadType.TEAM) {
      // Allow access
    } else if (thread.type === ChatThreadType.DIRECT) {
      const isParticipant = thread.user1Id === userId || thread.user2Id === userId

      if (!isParticipant) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // Check if user is SUPER_ADMIN OR thread has SUPER_ADMIN participant
      const hasSuperAdmin =
        userRole === UserRole.SUPER_ADMIN ||
        thread.User_chat_threads_user1IdToUser?.role === UserRole.SUPER_ADMIN ||
        thread.User_chat_threads_user2IdToUser?.role === UserRole.SUPER_ADMIN

      if (!hasSuperAdmin) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json({ error: 'Invalid thread type' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before')

    const where: any = {
      threadId,
      isDeleted: false,
    }

    if (before) {
      where.createdAt = { lt: new Date(before) }
    }

    const messages = await prisma.chat_messages.findMany({
      where,
      include: {
        User: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ messages: messages.reverse() })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/chat/threads/[id]/messages - Send a message
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: threadId } = await context.params

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role as UserRole

    const body = await request.json()
    const validated = sendMessageSchema.parse(body)

    // Verify access to thread
    const thread = await prisma.chat_threads.findUnique({
      where: { id: threadId },
      include: {
        User_chat_threads_user1IdToUser: { select: { role: true } },
        User_chat_threads_user2IdToUser: { select: { role: true } },
      },
    })

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Access control: TEAM thread - any authenticated user
    if (thread.type === ChatThreadType.TEAM) {
      // Allow access
    } else if (thread.type === ChatThreadType.DIRECT) {
      const isParticipant = thread.user1Id === userId || thread.user2Id === userId

      if (!isParticipant) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // Check if user is SUPER_ADMIN OR thread has SUPER_ADMIN participant
      const hasSuperAdmin =
        userRole === UserRole.SUPER_ADMIN ||
        thread.User_chat_threads_user1IdToUser?.role === UserRole.SUPER_ADMIN ||
        thread.User_chat_threads_user2IdToUser?.role === UserRole.SUPER_ADMIN

      if (!hasSuperAdmin) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    } else {
      return NextResponse.json({ error: 'Invalid thread type' }, { status: 400 })
    }

    // Create message
    const message = await prisma.chat_messages.create({
      data: {
        id: randomUUID(),
        threadId,
        senderId: userId,
        message: validated.message,
      },
      include: {
        User: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    // Update unread counts for all participants except sender
    const participants: string[] = []

    if (thread.type === ChatThreadType.TEAM) {
      // For TEAM thread, get all active users
      const allUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      participants.push(...allUsers.map((u) => u.id))
    } else if (thread.type === ChatThreadType.DIRECT) {
      if (thread.user1Id) participants.push(thread.user1Id)
      if (thread.user2Id) participants.push(thread.user2Id)
    }

    // Update unread counts (excluding sender) - use parallel batch operations
    const recipients = participants.filter((id) => id !== userId)

    if (recipients.length > 0) {
      // Execute all upserts in parallel for maximum performance
      // Using Promise.allSettled to ensure all operations complete even if some fail
      await Promise.allSettled(
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
      )
    }

    return NextResponse.json({ message })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

