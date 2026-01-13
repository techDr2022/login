export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { UserRole, ChatThreadType } from '@prisma/client'
import { createChatThreadSchema } from '@/lib/validations'

// GET /api/chat/threads - List threads for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role as UserRole

    // Get TEAM thread (single global thread) - create if doesn't exist
    let teamThread = await prisma.chat_threads.findFirst({
      where: { type: ChatThreadType.TEAM },
      include: {
          chat_messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { User: { select: { id: true, name: true, email: true } } },
          },
        chat_unread_counts: {
          where: { userId },
        },
      },
    })

    // Auto-create team thread if it doesn't exist
    if (!teamThread) {
      teamThread = await prisma.chat_threads.create({
        data: { id: randomUUID(), type: ChatThreadType.TEAM },
        include: {
          chat_messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { User: { select: { id: true, name: true, email: true } } },
          },
          chat_unread_counts: {
            where: { userId },
          },
        },
      })
    }

    // Get DIRECT threads where user is a participant
    const directThreads = await prisma.chat_threads.findMany({
      where: {
        type: ChatThreadType.DIRECT,
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
          User_chat_threads_user1IdToUser: { select: { id: true, name: true, email: true, role: true } },
          User_chat_threads_user2IdToUser: { select: { id: true, name: true, email: true, role: true } },
          chat_messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { User: { select: { id: true, name: true, email: true } } },
          },
        chat_unread_counts: {
          where: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format threads
    const formattedThreads = []

    if (teamThread) {
      const unreadCount = teamThread.chat_unread_counts[0]?.count || 0
      formattedThreads.push({
        id: teamThread.id,
        type: teamThread.type,
        unreadCount,
        lastMessage: teamThread.chat_messages[0]
          ? {
              id: teamThread.chat_messages[0].id,
              message: teamThread.chat_messages[0].message,
              sender: teamThread.chat_messages[0].User,
              createdAt: teamThread.chat_messages[0].createdAt,
            }
          : null,
        participants: [],
      })
    }

    for (const thread of directThreads) {
      const unreadCount = thread.chat_unread_counts[0]?.count || 0
      const otherUser = thread.user1Id === userId ? thread.User_chat_threads_user2IdToUser : thread.User_chat_threads_user1IdToUser

      formattedThreads.push({
        id: thread.id,
        type: thread.type,
        unreadCount,
        lastMessage: thread.chat_messages[0]
          ? {
              id: thread.chat_messages[0].id,
              message: thread.chat_messages[0].message,
              sender: thread.chat_messages[0].User,
              createdAt: thread.chat_messages[0].createdAt,
            }
          : null,
        participants: otherUser ? [otherUser] : [],
      })
    }

    return NextResponse.json({ threads: formattedThreads })
  } catch (error) {
    console.error('Error fetching threads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/chat/threads - Create a new thread
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role as UserRole

    const body = await request.json()
    const validated = createChatThreadSchema.parse(body)

    // TEAM thread creation - check if one exists, create if not
    if (validated.type === ChatThreadType.TEAM) {
      let teamThread = await prisma.chat_threads.findFirst({
        where: { type: ChatThreadType.TEAM },
      })

      if (!teamThread) {
        teamThread = await prisma.chat_threads.create({
          data: { id: randomUUID(), type: ChatThreadType.TEAM },
        })
      }

      return NextResponse.json({ thread: teamThread })
    }

    // DIRECT thread creation - STRICT PERMISSIONS
    if (validated.type === ChatThreadType.DIRECT) {
      // Only SUPER_ADMIN can create DIRECT threads
      if (userRole !== UserRole.SUPER_ADMIN) {
        return NextResponse.json(
          { error: 'Only Super Admins can create direct threads' },
          { status: 403 }
        )
      }

      if (!validated.targetUserId) {
        return NextResponse.json(
          { error: 'targetUserId is required for DIRECT threads' },
          { status: 400 }
        )
      }

      // Get target user
      const targetUser = await prisma.user.findUnique({
        where: { id: validated.targetUserId },
        select: { id: true, role: true },
      })

      if (!targetUser) {
        return NextResponse.json(
          { error: 'Target user not found' },
          { status: 404 }
        )
      }

      // Check if thread already exists
      const existingThread = await prisma.chat_threads.findFirst({
        where: {
          type: ChatThreadType.DIRECT,
          OR: [
            { user1Id: userId, user2Id: validated.targetUserId },
            { user1Id: validated.targetUserId, user2Id: userId },
          ],
        },
      })

      if (existingThread) {
        return NextResponse.json({ thread: existingThread })
      }

      // Create new DIRECT thread
      const thread = await prisma.chat_threads.create({
        data: {
          id: randomUUID(),
          type: ChatThreadType.DIRECT,
          user1Id: userId,
          user2Id: validated.targetUserId,
        },
        include: {
          User_chat_threads_user1IdToUser: { select: { id: true, name: true, email: true, role: true } },
          User_chat_threads_user2IdToUser: { select: { id: true, name: true, email: true, role: true } },
        },
      })

      return NextResponse.json({ thread })
    }

    return NextResponse.json(
      { error: 'Invalid thread type' },
      { status: 400 }
    )
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating thread:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

