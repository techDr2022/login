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

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            assignedTasks: true,
            attendances: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Calculate metrics for each employee
    const employeesWithMetrics = await Promise.all(
      employees.map(async (employee) => {
        // Completed tasks
        const completedTasks = await prisma.task.count({
          where: {
            assignedToId: employee.id,
            status: 'Approved',
          },
        })

        // Total tasks
        const totalTasks = employee._count.assignedTasks

        // Total attendance records
        const totalAttendance = employee._count.attendances

        // Present days (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const presentDays = await prisma.attendance.count({
          where: {
            userId: employee.id,
            status: 'Present',
            date: {
              gte: thirtyDaysAgo,
            },
          },
        })

        // Performance score (0-100)
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        const attendanceRate = 30 > 0 ? (presentDays / 30) * 100 : 0
        const performanceScore = (completionRate * 0.6 + attendanceRate * 0.4)

        return {
          ...employee,
          metrics: {
            completedTasks,
            totalTasks,
            totalAttendance,
            presentDays,
            performanceScore: Math.round(performanceScore),
          },
        }
      })
    )

    return NextResponse.json({ employees: employeesWithMetrics })
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

