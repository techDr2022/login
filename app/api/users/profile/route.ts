export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const jobTitle = String(body?.jobTitle || '').trim()

    if (!email) {
      return NextResponse.json({ error: 'Personal email is required' }, { status: 400 })
    }
    if (!jobTitle) {
      return NextResponse.json({ error: 'Designation is required' }, { status: 400 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    })

    if (!currentUser || !currentUser.isActive) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (emailOwner && emailOwner.id !== currentUser.id) {
      return NextResponse.json({ error: 'This email is already used by another user' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        email,
        jobTitle,
      },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
      },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
