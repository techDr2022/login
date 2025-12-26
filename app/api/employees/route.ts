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

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all users (employees and managers) for super admin, including inactive ones
    const employees = await prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.EMPLOYEE, UserRole.MANAGER],
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
        const totalTasks = await prisma.task.count({
          where: {
            assignedToId: employee.id,
          },
        })

        // Total attendance records
        const totalAttendance = await prisma.attendances.count({
          where: {
            userId: employee.id,
          },
        })

        // Present days (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const presentDays = await prisma.attendances.count({
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
  } catch (error: any) {
    console.error('Error fetching employees:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

