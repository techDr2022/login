export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/users/notifications - Get current user's notification preferences
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        isActive: true,
        notifyTaskUpdates: true,
        notifyClientChanges: true,
        notifyChatMentions: true,
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User not found in database. Please log in again.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      notifyTaskUpdates: user.notifyTaskUpdates ?? true,
      notifyClientChanges: user.notifyClientChanges ?? true,
      notifyChatMentions: user.notifyChatMentions ?? true,
    })
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/users/notifications - Update current user's notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First verify the user exists and is active
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    })

    if (!existingUser || !existingUser.isActive) {
      return NextResponse.json(
        { error: 'User not found in database. Please log in again.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { notifyTaskUpdates, notifyClientChanges, notifyChatMentions } = body

    // Validate that at least one preference is provided
    if (
      notifyTaskUpdates === undefined &&
      notifyClientChanges === undefined &&
      notifyChatMentions === undefined
    ) {
      return NextResponse.json(
        { error: 'At least one notification preference must be provided' },
        { status: 400 }
      )
    }

    // Build update object with only provided fields
    const updateData: {
      notifyTaskUpdates?: boolean
      notifyClientChanges?: boolean
      notifyChatMentions?: boolean
    } = {}

    if (notifyTaskUpdates !== undefined) {
      updateData.notifyTaskUpdates = Boolean(notifyTaskUpdates)
    }
    if (notifyClientChanges !== undefined) {
      updateData.notifyClientChanges = Boolean(notifyClientChanges)
    }
    if (notifyChatMentions !== undefined) {
      updateData.notifyChatMentions = Boolean(notifyChatMentions)
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        notifyTaskUpdates: true,
        notifyClientChanges: true,
        notifyChatMentions: true,
      },
    })

    return NextResponse.json({
      notifyTaskUpdates: updatedUser.notifyTaskUpdates ?? true,
      notifyClientChanges: updatedUser.notifyClientChanges ?? true,
      notifyChatMentions: updatedUser.notifyChatMentions ?? true,
    })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

