export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { canViewAllTasks } from '@/lib/rbac'
import { taskEngineDetail } from '@/lib/engine/query'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role as UserRole
    const userId = session.user.id
    const canViewAll = canViewAllTasks(userRole)

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        User_Task_assignedToIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        User_Task_assignedByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Client: {
          select: {
            id: true,
            name: true,
          },
        },
        worktemplate: {
          select: {
            istimelock: true,
            donewhen: true,
            needsconfirmation: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // For non-admin users, check if they have access to this task
    if (!canViewAll && userId) {
      const onTemplate = task.templateid
        ? await prisma.worktemplateassignee.findFirst({
            where: { templateid: task.templateid, userid: userId },
            select: { id: true },
          })
        : null
      const hasAccess =
        task.assignedToId === userId ||
        task.assignedById === userId ||
        task.waitingonuserid === userId ||
        !!onTemplate
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const engine = await taskEngineDetail(task.id, task.templateid)
    const transformedTask = {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      startDate: task.startDate,
      createdAt: task.createdAt,
      timeSpent: task.timeSpent,
      rejectionFeedback: task.rejectionFeedback,
      assignedToId: task.assignedToId,
      assignedById: task.assignedById,
      templateid: task.templateid,
      revisioncount: task.revisioncount,
      noinputflag: task.noinputflag,
      istimelock: task.worktemplate?.istimelock ?? false,
      donewhen: task.worktemplate?.donewhen ?? null,
      needsconfirmation: task.worktemplate?.needsconfirmation ?? false,
      assignedTo: task.User_Task_assignedToIdToUser || null,
      assignedBy: task.User_Task_assignedByIdToUser || null,
      client: task.Client ? { id: task.Client.id, name: task.Client.name } : null,
      history: engine.history,
      dependencies: engine.dependencies,
    }

    return NextResponse.json(transformedTask)
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

