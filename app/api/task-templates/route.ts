export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Active templates for task create UI (web + extension). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await prisma.taskTemplate.findMany({
      where: { isActive: true },
      orderBy: { taskType: 'asc' },
      select: {
        taskType: true,
        durationHours: true,
        isActive: true,
      },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching task templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
