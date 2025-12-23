import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

// GET /api/chat/users - Get users for direct chat (only for Managers/Super Admins)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as UserRole

    // Only MANAGER/SUPER_ADMIN can list users for direct chat
    if (userRole !== UserRole.MANAGER && userRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only Managers and Super Admins can list users for direct chat' },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: session.user.id }, // Exclude current user
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching chat users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

