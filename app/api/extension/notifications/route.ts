export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyExtensionToken } from '@/lib/extension-auth'

const STAFF_ROLES = new Set<string>([
  UserRole.EMPLOYEE,
  UserRole.MANAGER,
  UserRole.SUPER_ADMIN,
])
const MAX_LOOKBACK_MS = 10 * 60 * 1000

function readToken(request: NextRequest): string {
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) throw new Error('Missing bearer token')
  return auth.slice(7)
}

export async function GET(request: NextRequest) {
  try {
    const auth = verifyExtensionToken(readToken(request))
    if (!STAFF_ROLES.has(auth.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestedSince = new Date(request.nextUrl.searchParams.get('since') || '')
    const minimumSince = new Date(Date.now() - MAX_LOOKBACK_MS)
    const since =
      Number.isNaN(requestedSince.getTime()) || requestedSince < minimumSince
        ? minimumSince
        : requestedSince

    const [createdTasks, activities] = await Promise.all([
      prisma.task.findMany({
        where: {
          assignedToId: { not: null },
          createdAt: { gt: since },
        },
        select: { id: true, createdAt: true },
        take: 100,
      }),
      prisma.activity_logs.findMany({
        where: {
          entityType: 'Task',
          action: { in: ['CREATE', 'UPDATE'] },
          timestamp: { gt: since },
        },
        select: { entityId: true, userId: true, timestamp: true },
        orderBy: { timestamp: 'asc' },
        take: 200,
      }),
    ])

    const taskIds = [
      ...new Set([
        ...createdTasks.map((task) => task.id),
        ...activities.map((activity) => activity.entityId),
      ]),
    ]
    if (taskIds.length === 0) {
      return NextResponse.json({ checkedAt: new Date().toISOString(), assignments: [] })
    }

    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        assignedToId: { not: null },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        assignedById: true,
        assignedToId: true,
        createdAt: true,
        User_Task_assignedByIdToUser: { select: { name: true } },
        User_Task_assignedToIdToUser: { select: { name: true } },
        Client: { select: { name: true } },
      },
    })

    const latestActivityByTask = new Map<
      string,
      { userId: string; timestamp: Date }
    >()
    for (const activity of activities) {
      latestActivityByTask.set(activity.entityId, {
        userId: activity.userId,
        timestamp: activity.timestamp,
      })
    }

    const assignments = tasks.map((task) => {
      const activity = latestActivityByTask.get(task.id)
      return {
        id: task.id,
        title: task.title,
        priority: task.priority,
        assignedById: task.assignedById,
        assignedByName: task.User_Task_assignedByIdToUser.name,
        assignedToId: task.assignedToId,
        assignedToName: task.User_Task_assignedToIdToUser?.name || 'Employee',
        clientName: task.Client?.name || null,
        actorId: activity?.userId || task.assignedById,
        eventAt: (activity?.timestamp || task.createdAt).toISOString(),
      }
    })

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      assignments,
    })
  } catch (error: any) {
    if (
      error?.message?.includes('token') ||
      error?.message?.includes('bearer')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Extension notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
