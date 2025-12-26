export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { updateUserRole, deleteUser, restoreUser } from '@/app/actions/employee-actions'

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

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const employee = await prisma.user.findUnique({
      where: { id },
      include: {
        attendances: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    })

    if (!employee || (employee.role !== UserRole.EMPLOYEE && employee.role !== UserRole.MANAGER)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get tasks assigned to this user
    const assignedTasks = await prisma.task.findMany({
      where: {
        assignedToId: employee.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate metrics
    const completedTasks = await prisma.task.count({
      where: {
        assignedToId: employee.id,
        status: 'Approved',
      },
    })

    const totalTasks = assignedTasks.length

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

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    const attendanceRate = 30 > 0 ? (presentDays / 30) * 100 : 0
    const performanceScore = (completionRate * 0.6 + attendanceRate * 0.4)

    return NextResponse.json({
      ...employee,
      assignedTasks,
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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { role, action } = body

    if (action === 'restore') {
      const restoredUser = await restoreUser(id)
      return NextResponse.json({ user: restoredUser })
    }

    if (role && (role === 'EMPLOYEE' || role === 'MANAGER')) {
      const updatedUser = await updateUserRole(id, role)
      return NextResponse.json({ user: updatedUser })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deletedUser = await deleteUser(id)
    return NextResponse.json({ user: deletedUser })
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    )
  }
}

