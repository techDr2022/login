export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, TaskStatus } from '@prisma/client'

// GET /api/admin/employees - Get all employees with performance metrics
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
    const status = searchParams.get('status') // 'active' | 'inactive' | 'all'
    const role = searchParams.get('role') // filter by role

    const where: any = {
      // Exclude SUPER_ADMIN from employee list (they're not employees)
      role: {
        not: UserRole.SUPER_ADMIN
      }
    }
    
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    // If role filter is specified, filter by that role (but still exclude SUPER_ADMIN)
    if (role && role !== 'all') {
      where.role = role as UserRole
    }

    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        joiningDate: true,
        adminNotes: true,
        Task_Task_assignedToIdToUser: {
          select: {
            id: true,
            status: true,
            dueDate: true,
            priority: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Calculate performance metrics for each employee
    const employeesWithMetrics = await Promise.all(
      employees.map(async (employee) => {
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

        // Calculate performance score (0-100)
        let performanceScore = 0
        if (totalTasks > 0) {
          const completionRate = (completedTasks / totalTasks) * 50 // 50 points max
          const onTimeRate = Math.max(
            0,
            ((totalTasks - overdueTasks) / totalTasks) * 30
          ) // 30 points max
          const consistencyBonus = Math.min(20, completedTasks * 0.5) // 20 points max
          performanceScore = Math.round(completionRate + onTimeRate + consistencyBonus)
        }

        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          isActive: employee.isActive,
          createdAt: employee.createdAt,
          joiningDate: employee.joiningDate,
          adminNotes: employee.adminNotes,
          totalTasks,
          completedTasks,
          pendingTasks,
          overdueTasks,
          performanceScore,
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

// POST /api/admin/employees - Create new employee
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, role, joiningDate, password, adminNotes } = body

    if (!name || !email || !role || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const bcrypt = require('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 10)

    // Generate random UUID for user ID
    const { randomUUID } = require('crypto')
    const userId = randomUUID()

    const user = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        passwordHash,
        role: role as UserRole,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        adminNotes: adminNotes || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        joiningDate: true,
      },
    })

    return NextResponse.json({
      user,
      credentials: {
        email,
        password, // Return plain password for display (only this time)
      },
    })
  } catch (error) {
    console.error('Error creating employee:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

