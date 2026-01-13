export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, ChatThreadType } from '@prisma/client'

// GET /api/chat/threads/[id] - Get thread details
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

    const thread = await prisma.chat_threads.findUnique({
      where: { id: threadId },
      include: {
        User_chat_threads_user1IdToUser: { select: { id: true, name: true, email: true, role: true } },
        User_chat_threads_user2IdToUser: { select: { id: true, name: true, email: true, role: true } },
        chat_unread_counts: {
          where: { userId },
        },
      },
    })

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Access control: TEAM thread - any authenticated user
    if (thread.type === ChatThreadType.TEAM) {
      return NextResponse.json({ thread })
    }

    // Access control: DIRECT thread
    if (thread.type === ChatThreadType.DIRECT) {
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
          { error: 'Access denied: Direct threads require Super Admin participation' },
          { status: 403 }
        )
      }

      return NextResponse.json({ thread })
    }

    return NextResponse.json({ error: 'Invalid thread type' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching thread:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

