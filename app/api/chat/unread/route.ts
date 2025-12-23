export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/chat/unread - Get total unread count
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Get all unread counts for user
    const unreadCounts = await prisma.chatUnreadCount.findMany({
      where: { userId },
      include: {
        thread: {
          select: {
            id: true,
            type: true,
            user1Id: true,
            user2Id: true,
          },
        },
      },
    })

    // Filter to only threads user has access to
    let totalUnread = 0

    for (const unread of unreadCounts) {
      // For TEAM thread, always count
      if (unread.thread.type === 'TEAM') {
        totalUnread += unread.count
      } else if (unread.thread.type === 'DIRECT') {
        // For DIRECT thread, verify user is participant
        if (unread.thread.user1Id === userId || unread.thread.user2Id === userId) {
          totalUnread += unread.count
        }
      }
    }

    return NextResponse.json({ totalUnread })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

