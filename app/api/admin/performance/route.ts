export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, TaskStatus } from '@prisma/client'

// GET /api/admin/performance - Get best performers
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
    const period = searchParams.get('period') || 'day' // 'day' | 'month'

    const now = new Date()
    let startDate: Date

    if (period === 'day') {
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
    } else {
      // Month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Get all employees (excluding SUPER_ADMIN)
    const employees = await prisma.user.findMany({
      where: {
        role: {
          not: UserRole.SUPER_ADMIN,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        Task_Task_assignedToIdToUser: {
          where: {
            createdAt: {
              gte: startDate,
            },
          },
          select: {
            id: true,
            status: true,
            dueDate: true,
            createdAt: true,
          },
        },
      },
    })

    // Calculate performance for each employee
    const employeesWithPerformance = employees.map((employee) => {
      const tasks = employee.Task_Task_assignedToIdToUser
      const totalTasks = tasks.length
      const completedTasks = tasks.filter(
        (t) => t.status === TaskStatus.Approved
      ).length
      const overdueTasks = tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < new Date() &&
          t.status !== TaskStatus.Approved
      ).length

      // Calculate performance score
      let performanceScore = 0
      if (totalTasks > 0) {
        const completionRate = (completedTasks / totalTasks) * 50
        const onTimeRate = Math.max(0, ((totalTasks - overdueTasks) / totalTasks) * 30)
        const consistencyBonus = Math.min(20, completedTasks * 0.5)
        performanceScore = Math.round(completionRate + onTimeRate + consistencyBonus)
      }

      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        completedTasks,
        totalTasks,
        overdueTasks,
        performanceScore,
      }
    })

    // Sort by performance score (descending), then by completed tasks
    employeesWithPerformance.sort((a, b) => {
      if (b.performanceScore !== a.performanceScore) {
        return b.performanceScore - a.performanceScore
      }
      return b.completedTasks - a.completedTasks
    })

    // Get best performer
    const bestPerformer =
      employeesWithPerformance.length > 0 ? employeesWithPerformance[0] : null

    return NextResponse.json({
      bestPerformer,
      period,
      allPerformers: employeesWithPerformance.slice(0, 10), // Top 10
    })
  } catch (error) {
    console.error('Error fetching performance data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

