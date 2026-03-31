export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRoomAccess } from '@/lib/chat-rooms'
import { UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import { sendRoomMessageSchema } from '@/lib/validations'
import { MessageReceiptStatus } from '@prisma/client'

/**
 * POST /api/chat/send
 * Body: { roomId, text, clientMsgId }
 * Idempotent: upsert by (roomId, clientMsgId). Returns the message.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = sendRoomMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { roomId, text, clientMsgId } = parsed.data
    const userRole = session.user.role as UserRole
    const access = await checkRoomAccess(roomId, session.user.id, userRole)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error ?? 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.chatMessage.findUnique({
      where: {
        roomId_clientMsgId: { roomId, clientMsgId },
      },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        receipts: { select: { userId: true, status: true } },
      },
    })
    if (existing) {
      return NextResponse.json({ message: existing })
    }

    const message = await prisma.chatMessage.create({
      data: {
        id: randomUUID(),
        roomId,
        senderId: session.user.id,
        text,
        clientMsgId,
      },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        receipts: true,
      },
    })

    const memberIds = await prisma.chatMember.findMany({
      where: { roomId },
      select: { userId: true },
    })
    const recipientIds = memberIds.map((m) => m.userId).filter((id) => id !== session.user.id)
    for (const uid of recipientIds) {
      await prisma.messageReceipt.upsert({
        where: {
          messageId_userId: { messageId: message.id, userId: uid },
        },
        create: {
          id: randomUUID(),
          messageId: message.id,
          userId: uid,
          status: MessageReceiptStatus.SENT,
        },
        update: {},
      })
    }
    await prisma.messageReceipt.upsert({
      where: {
        messageId_userId: { messageId: message.id, userId: session.user.id },
      },
      create: {
        id: randomUUID(),
        messageId: message.id,
        userId: session.user.id,
        status: MessageReceiptStatus.SENT,
      },
      update: {},
    })

    const withReceipts = await prisma.chatMessage.findUnique({
      where: { id: message.id },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        receipts: { select: { userId: true, status: true } },
      },
    })

    return NextResponse.json({ message: withReceipts ?? message })
  } catch (error) {
    console.error('Chat send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
