export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyExtensionToken } from '@/lib/extension-auth'
import { UserRole } from '@prisma/client'

function readToken(request: NextRequest): string {
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) throw new Error('Missing bearer token')
  return auth.slice(7)
}

export async function GET(request: NextRequest) {
  try {
    const token = readToken(request)
    verifyExtensionToken(token)

    const [users, clients, templates] = await Promise.all([
      prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.SUPER_ADMIN] },
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      }),
      prisma.client.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.taskTemplate.findMany({
        where: { isActive: true },
        select: { taskType: true, durationHours: true },
        orderBy: { taskType: 'asc' },
      }),
    ])

    return NextResponse.json({ users, clients, templates })
  } catch (error: any) {
    if (error?.message?.includes('token') || error?.message?.includes('bearer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Extension bootstrap error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

