export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOrCreateTeamRoom, getOrCreateDirectRoom } from '@/lib/chat-rooms'
import { UserRole } from '@prisma/client'

/**
 * GET /api/chat/rooms
 * Returns list of rooms for current user: TEAM + DIRECT rooms with last message and unread count (from lastReadAt).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    await getOrCreateTeamRoom(userId)

    const memberships = await prisma.chatMember.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true, role: true } } },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: { sender: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    })

    const rooms: Array<{
      id: string
      type: 'TEAM' | 'DIRECT'
      unreadCount: number
      lastMessage: {
        id: string
        text: string
        sender: { id: string; name: string; email: string }
        createdAt: string
      } | null
      participants: Array<{ id: string; name: string; email: string; role: string }>
    }> = []

    for (const m of memberships) {
      const room = m.room
      const lastMsg = room.messages[0]
      const lastReadAt = m.lastReadAt ?? new Date(0)
      const unreadCount = lastMsg
        ? await prisma.chatMessage.count({
            where: {
              roomId: room.id,
              createdAt: { gt: lastReadAt },
              senderId: { not: userId },
            },
          })
        : 0
      const participants =
        room.type === 'DIRECT'
          ? room.members.filter((x) => x.userId !== userId).map((x) => x.user)
          : []
      rooms.push({
        id: room.id,
        type: room.type as 'TEAM' | 'DIRECT',
        unreadCount,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              text: lastMsg.text,
              sender: lastMsg.sender,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
        participants,
      })
    }

    return NextResponse.json({ rooms })
  } catch (error) {
    console.error('Chat rooms list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/chat/rooms
 * Body: { type: 'TEAM' | 'DIRECT', targetUserId?: string }
 * Create or get TEAM room (no target) or DIRECT room (targetUserId). Only Manager/SuperAdmin can create DIRECT.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const type = body.type as 'TEAM' | 'DIRECT'
    const targetUserId = body.targetUserId as string | undefined

    if (type === 'TEAM') {
      const { id } = await getOrCreateTeamRoom(session.user.id)
      const room = await prisma.chatRoom.findUnique({
        where: { id },
        include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } },
      })
      return NextResponse.json({ room })
    }

    if (type === 'DIRECT') {
      if (!targetUserId) {
        return NextResponse.json({ error: 'targetUserId is required for DIRECT room' }, { status: 400 })
      }
      const userRole = session.user.role as UserRole
      const result = await getOrCreateDirectRoom(session.user.id, userRole, targetUserId)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      const room = await prisma.chatRoom.findUnique({
        where: { id: result.roomId },
        include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } },
      })
      return NextResponse.json({ room })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    console.error('Chat rooms create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
