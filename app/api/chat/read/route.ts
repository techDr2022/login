import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { markReadSchema } from '@/lib/validations'

// POST /api/chat/read - Mark thread as read
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const validated = markReadSchema.parse(body)

    // Verify user has access to thread
    const thread = await prisma.chatThread.findUnique({
      where: { id: validated.threadId },
    })

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Reset unread count to 0
    await prisma.chatUnreadCount.upsert({
      where: {
        threadId_userId: {
          threadId: validated.threadId,
          userId,
        },
      },
      update: {
        count: 0,
      },
      create: {
        threadId: validated.threadId,
        userId,
        count: 0,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error marking thread as read:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

