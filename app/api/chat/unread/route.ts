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
    const unreadCounts = await prisma.chat_unread_counts.findMany({
      where: { userId },
      include: {
        chat_threads: {
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
      if (unread.chat_threads.type === 'TEAM') {
        totalUnread += unread.count
      } else if (unread.chat_threads.type === 'DIRECT') {
        // For DIRECT thread, verify user is participant
        if (unread.chat_threads.user1Id === userId || unread.chat_threads.user2Id === userId) {
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

