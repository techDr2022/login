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

    const { phoneNumber } = await request.json()

    // phoneNumber can be null to clear it
    if (phoneNumber !== null && phoneNumber !== undefined && typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number must be a string or null' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { phoneNumber: phoneNumber || null },
      select: {
        id: true,
        phoneNumber: true,
      },
    })

    return NextResponse.json({ success: true, phoneNumber: phoneNumber || null })
  } catch (error) {
    console.error('Error updating phone number:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

