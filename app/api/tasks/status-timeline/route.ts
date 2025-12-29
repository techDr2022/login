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

    // Get recent task updates from activity logs
    const recentUpdates = await prisma.activity_logs.findMany({
      where: {
        entityType: 'Task',
        action: 'UPDATE',
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 20,
    })

    // Fetch task details for each update
    const taskIds = [...new Set(recentUpdates.map((log) => log.entityId))]
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    })

    const taskMap = new Map(tasks.map((task) => [task.id, task]))

    // Build status changes (we'll use current task status as newStatus)
    // In a real implementation, you'd want to track old/new status in activity logs
    const statusChanges = recentUpdates
      .map((log) => {
        const task = taskMap.get(log.entityId)
        if (!task) return null

        return {
          id: log.id,
          taskId: task.id,
          taskTitle: task.title,
          newStatus: task.status,
          changedBy: log.userId,
          changedByName: log.User.name,
          timestamp: log.timestamp.toISOString(),
        }
      })
      .filter((change): change is NonNullable<typeof change> => change !== null)

    return NextResponse.json({
      statusChanges,
    })
  } catch (error) {
    console.error('Error fetching status timeline:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

