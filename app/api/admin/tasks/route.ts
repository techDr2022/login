export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, TaskStatus, TaskPriority } from '@prisma/client'

// GET /api/admin/tasks - Get tasks with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status') as TaskStatus | null
    const priority = searchParams.get('priority') as TaskPriority | null
    const dueDateFilter = searchParams.get('dueDate') // 'today' | 'week'
    const showTodayOnly = searchParams.get('todayOnly') === 'true'

    const where: any = {}

    if (employeeId) {
      where.assignedToId = employeeId
    }

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    if (showTodayOnly || dueDateFilter === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      where.dueDate = {
        gte: today,
        lt: tomorrow,
      }
    } else if (dueDateFilter === 'week') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const nextWeek = new Date(today)
      nextWeek.setDate(nextWeek.getDate() + 7)
      where.dueDate = {
        gte: today,
        lt: nextWeek,
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        User_Task_assignedToIdToUser: {
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
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to prevent performance issues
    })

    // Group tasks by employee if showTodayOnly is true
    let groupedTasks: any = null
    if (showTodayOnly) {
      groupedTasks = tasks.reduce((acc: any, task) => {
        const employeeId = task.assignedToId || 'unassigned'
        const employeeName =
          task.User_Task_assignedToIdToUser?.name || 'Unassigned'

        if (!acc[employeeId]) {
          acc[employeeId] = {
            employeeId,
            employeeName,
            tasks: [],
          }
        }
        acc[employeeId].tasks.push(task)
        return acc
      }, {})
      groupedTasks = Object.values(groupedTasks)
    }

    return NextResponse.json({
      tasks,
      groupedTasks,
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

