export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/chat/rooms/unread
 * Returns total unread count across all rooms (messages after lastReadAt per room).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await prisma.chatMember.findMany({
      where: { userId: session.user.id },
      select: { roomId: true, lastReadAt: true },
    })

    let totalUnread = 0
    for (const m of memberships) {
      const lastReadAt = m.lastReadAt ?? new Date(0)
      const count = await prisma.chatMessage.count({
        where: {
          roomId: m.roomId,
          createdAt: { gt: lastReadAt },
          senderId: { not: session.user.id },
        },
      })
      totalUnread += count
    }

    return NextResponse.json({ totalUnread })
  } catch (error) {
    console.error('Chat unread error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
