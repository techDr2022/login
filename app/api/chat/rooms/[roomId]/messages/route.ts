export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRoomAccess } from '@/lib/chat-rooms'
import { UserRole } from '@prisma/client'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/**
 * GET /api/chat/rooms/[roomId]/messages?limit=50&before=ISO_DATE
 * Returns last N messages (default 50) for the room, optionally before a cursor.
 * Use index (roomId, createdAt) for performance.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await context.params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as UserRole
    const access = await checkRoomAccess(roomId, session.user.id, userRole)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error ?? 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    )
    const before = searchParams.get('before')

    const where: { roomId: string; createdAt?: { lt: Date } } = { roomId }
    if (before) {
      where.createdAt = { lt: new Date(before) }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        receipts: { select: { userId: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const reversed = messages.reverse().map((m) => ({
      id: m.id,
      roomId: m.roomId,
      senderId: m.senderId,
      text: m.text,
      clientMsgId: m.clientMsgId,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender,
      receipts: m.receipts,
    }))

    return NextResponse.json({ messages: reversed })
  } catch (error) {
    console.error('Chat room messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
