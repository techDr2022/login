export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { canViewAllTasks } from '@/lib/rbac'

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
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // For non-admin users, check if they have access to this task
    if (!canViewAll && userId) {
      const hasAccess = task.assignedToId === userId || task.assignedById === userId
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Transform task to map Prisma relation names to expected field names
    const transformedTask = {
      ...task,
      assignedTo: task.User_Task_assignedToIdToUser || null,
      assignedBy: task.User_Task_assignedByIdToUser || null,
      client: task.Client || null,
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

