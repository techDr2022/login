export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, TaskStatus } from '@prisma/client'

// GET /api/admin/employees/[id] - Get employee details with performance data
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    const employee = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        joiningDate: true,
        adminNotes: true,
        phoneNumber: true,
        Task_Task_assignedToIdToUser: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            Client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        attendances: {
          take: 30,
          orderBy: { date: 'desc' },
          select: {
            id: true,
            date: true,
            status: true,
            totalHours: true,
            loginTime: true,
            logoutTime: true,
          },
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Calculate performance metrics
    const tasks = employee.Task_Task_assignedToIdToUser
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(
      (t) => t.status === TaskStatus.Approved
    ).length
    const pendingTasks = tasks.filter(
      (t) => t.status === TaskStatus.Pending || t.status === TaskStatus.InProgress
    ).length
    const overdueTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        t.status !== TaskStatus.Approved
    ).length

    // Last 30 days task history
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentTasks = tasks.filter(
      (t) => new Date(t.createdAt) >= thirtyDaysAgo
    )

    // Performance trend (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const last7DaysTasks = tasks.filter(
      (t) => new Date(t.createdAt) >= sevenDaysAgo
    )

    // Calculate performance score
    let performanceScore = 0
    if (totalTasks > 0) {
      const completionRate = (completedTasks / totalTasks) * 50
      const onTimeRate = Math.max(0, ((totalTasks - overdueTasks) / totalTasks) * 30)
      const consistencyBonus = Math.min(20, completedTasks * 0.5)
      performanceScore = Math.round(completionRate + onTimeRate + consistencyBonus)
    }

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    return NextResponse.json({
      employee: {
        ...employee,
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        performanceScore,
        completionRate: Math.round(completionRate),
        recentTasks,
        last7DaysTasks,
      },
    })
  } catch (error) {
    console.error('Error fetching employee details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/employees/[id] - Update employee
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { name, email, role, isActive, joiningDate, adminNotes, phoneNumber } = body

    // Check if email is being changed and if it already exists
    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser && existingUser.id !== id) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (role !== undefined) updateData.role = role as UserRole
    if (isActive !== undefined) updateData.isActive = isActive
    if (joiningDate !== undefined)
      updateData.joiningDate = joiningDate ? new Date(joiningDate) : null
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        joiningDate: true,
        adminNotes: true,
        phoneNumber: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error updating employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/employees/[id] - Delete employee (soft delete recommended)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    // Prevent deleting yourself
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if employee exists
    const employee = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Prevent deleting SUPER_ADMIN users
    if (employee.role === UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Cannot delete Super Admin users' },
        { status: 400 }
      )
    }

    if (hardDelete) {
      // Hard delete - only if explicitly requested
      // First, set all foreign key references to null to avoid constraint errors
      await prisma.$transaction(async (tx) => {
        // Set assignedToId to null for all tasks assigned to this user
        await tx.task.updateMany({
          where: { assignedToId: id },
          data: { assignedToId: null },
        })

        // Set accountManagerId to null for all clients managed by this user
        await tx.client.updateMany({
          where: { accountManagerId: id },
          data: { accountManagerId: null },
        })

        // Set assignedToId to null for all client_tasks assigned to this user
        await tx.client_tasks.updateMany({
          where: { assignedToId: id },
          data: { assignedToId: null },
        })

        // Now delete the user (cascade will handle other relations)
        await tx.user.delete({
          where: { id },
        })
      })
    } else {
      // Soft delete - set isActive to false
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      })
    }

    return NextResponse.json({ 
      success: true,
      message: hardDelete ? 'Employee permanently deleted' : 'Employee deactivated'
    })
  } catch (error: any) {
    console.error('Error deleting employee:', error)
    
    // Handle Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    
    // Handle foreign key constraint errors
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete employee: There are related records that prevent deletion. Please deactivate instead.' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

