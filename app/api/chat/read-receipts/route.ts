export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRoomAccess } from '@/lib/chat-rooms'
import { UserRole } from '@prisma/client'
import { markRoomReadSchema } from '@/lib/validations'
import { prisma } from '@/lib/prisma'
import { MessageReceiptStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * POST /api/chat/read-receipts
 * Body: { roomId }
 * Updates ChatMember.lastReadAt for current user (when room is opened).
 * Optionally updates MessageReceipt to READ for messages in that room up to lastReadAt.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = markRoomReadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { roomId } = parsed.data
    const userRole = session.user.role as UserRole
    const access = await checkRoomAccess(roomId, session.user.id, userRole)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error ?? 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    await prisma.chatMember.updateMany({
      where: { roomId, userId: session.user.id },
      data: { lastReadAt: now },
    })

    const messagesInRoom = await prisma.chatMessage.findMany({
      where: { roomId, createdAt: { lte: now } },
      select: { id: true },
    })
    for (const msg of messagesInRoom) {
      await prisma.messageReceipt.upsert({
        where: {
          messageId_userId: { messageId: msg.id, userId: session.user.id },
        },
        create: {
          id: randomUUID(),
          messageId: msg.id,
          userId: session.user.id,
          status: MessageReceiptStatus.READ,
        },
        update: { status: MessageReceiptStatus.READ },
      })
    }

    return NextResponse.json({ success: true, lastReadAt: now.toISOString() })
  } catch (error) {
    console.error('Chat read-receipts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
