export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRoomAccess } from '@/lib/chat-rooms'
import { UserRole } from '@prisma/client'

/**
 * GET /api/chat/stream?roomId=...
 * SSE stream: sends new messages for the given room only.
 * Fetch last 50 via GET /api/chat/rooms/[roomId]/messages first, then open this stream and append new messages.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const roomId = request.nextUrl.searchParams.get('roomId')
  if (!roomId) {
    return new Response('roomId is required', { status: 400 })
  }

  const userRole = session.user.role as UserRole
  const access = await checkRoomAccess(roomId, session.user.id, userRole)
  if (!access.allowed) {
    return new Response(access.error ?? 'Forbidden', { status: 403 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false
      let lastCheck = new Date(Date.now() - 2000)

      const sendEvent = (data: object) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch (e) {
          console.error('SSE send error:', e)
        }
      }

      sendEvent({ type: 'connected', roomId, userId: session.user.id })

      const pollInterval = setInterval(async () => {
        if (isClosed) return
        try {
          const checkFrom = new Date(lastCheck.getTime() - 1000)
          const newMessages = await prisma.chatMessage.findMany({
            where: {
              roomId,
              senderId: { not: session.user.id },
              createdAt: { gt: checkFrom },
            },
            include: {
              sender: { select: { id: true, name: true, email: true, role: true } },
              receipts: { select: { userId: true, status: true } },
            },
            orderBy: { createdAt: 'asc' },
          })
          for (const msg of newMessages) {
            sendEvent({
              type: 'new_message',
              message: {
                id: msg.id,
                roomId: msg.roomId,
                text: msg.text,
                clientMsgId: msg.clientMsgId,
                senderId: msg.senderId,
                sender: msg.sender,
                createdAt: msg.createdAt,
                receipts: msg.receipts,
              },
            })
          }
          lastCheck = new Date()
        } catch (error) {
          console.error('Chat stream poll error:', error)
        }
      }, 1500)

      const cleanup = () => {
        isClosed = true
        clearInterval(pollInterval)
        try {
          controller.close()
        } catch (_) {}
      }

      if (request.signal) {
        request.signal.addEventListener('abort', cleanup)
      }
      setTimeout(cleanup, 5 * 60 * 1000)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
