export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const roleParam = searchParams.get('role')

    // Build where clause
    const where: any = {
      isActive: true,
    }

    // If role parameter is provided, filter by role
    if (roleParam) {
      // Validate role parameter
      const validRoles = Object.values(UserRole)
      if (validRoles.includes(roleParam as UserRole)) {
        where.role = roleParam as UserRole
      }
    } else {
      // If no role specified, return all active users (employees and super admins)
      // This is useful for task assignment dropdowns
      where.role = {
        in: [UserRole.EMPLOYEE, UserRole.SUPER_ADMIN],
      }
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    })

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API /users] Returning ${users.length} users`, {
        roleFilter: roleParam || 'all (EMPLOYEE + SUPER_ADMIN)',
        users: users.map(u => ({ name: u.name, email: u.email, role: u.role })),
      })
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

