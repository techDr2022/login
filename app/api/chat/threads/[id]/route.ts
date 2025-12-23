import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, ChatThreadType } from '@prisma/client'

// GET /api/chat/threads/[id] - Get thread details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role as UserRole
    const threadId = params.id

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
      include: {
        user1: { select: { id: true, name: true, email: true, role: true } },
        user2: { select: { id: true, name: true, email: true, role: true } },
        unreadCounts: {
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

      // Check if user is MANAGER/SUPER_ADMIN OR thread has MANAGER/SUPER_ADMIN participant
      const hasManagerOrSuperAdmin =
        userRole === UserRole.MANAGER ||
        userRole === UserRole.SUPER_ADMIN ||
        thread.user1?.role === UserRole.MANAGER ||
        thread.user1?.role === UserRole.SUPER_ADMIN ||
        thread.user2?.role === UserRole.MANAGER ||
        thread.user2?.role === UserRole.SUPER_ADMIN

      if (!hasManagerOrSuperAdmin) {
        return NextResponse.json(
          { error: 'Access denied: Direct threads require Manager or Super Admin participation' },
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

