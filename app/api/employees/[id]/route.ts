export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const employee = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        assignedTasks: {
          orderBy: { createdAt: 'desc' },
        },
        attendances: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    })

    if (!employee || employee.role !== UserRole.EMPLOYEE) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Calculate metrics
    const completedTasks = await prisma.task.count({
      where: {
        assignedToId: employee.id,
        status: 'Approved',
      },
    })

    const totalTasks = employee.assignedTasks.length

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

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    const attendanceRate = 30 > 0 ? (presentDays / 30) * 100 : 0
    const performanceScore = (completionRate * 0.6 + attendanceRate * 0.4)

    return NextResponse.json({
      ...employee,
      metrics: {
        completedTasks,
        totalTasks,
        presentDays,
        performanceScore: Math.round(performanceScore),
      },
    })
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

