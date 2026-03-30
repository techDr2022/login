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

    // If role filter is specified, filter by that role
    // Note: The UI doesn't allow selecting SUPER_ADMIN, so this is safe
    if (role && role !== 'all') {
      where.role = role as UserRole
    }

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('Employees query where clause:', JSON.stringify(where, null, 2))
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
        phoneNumber: true,
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

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`Found ${employees.length} employees matching query`)
    }

    // Calculate performance metrics for each employee
    const employeesWithMetrics = employees.map((employee) => {
      try {
        const tasks = employee.Task_Task_assignedToIdToUser || []
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

        // Safely convert dates to ISO strings
        let createdAtStr: string
        try {
          createdAtStr = employee.createdAt instanceof Date 
            ? employee.createdAt.toISOString() 
            : new Date(employee.createdAt).toISOString()
        } catch (dateError) {
          console.error(`Error converting createdAt for employee ${employee.id}:`, dateError)
          createdAtStr = new Date().toISOString() // Fallback to current date
        }

        let joiningDateStr: string | null = null
        if (employee.joiningDate) {
          try {
            joiningDateStr = employee.joiningDate instanceof Date 
              ? employee.joiningDate.toISOString() 
              : new Date(employee.joiningDate).toISOString()
          } catch (dateError) {
            console.error(`Error converting joiningDate for employee ${employee.id}:`, dateError)
            joiningDateStr = null
          }
        }

        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          isActive: employee.isActive,
          createdAt: createdAtStr,
          joiningDate: joiningDateStr,
          adminNotes: employee.adminNotes,
          phoneNumber: employee.phoneNumber,
          totalTasks,
          completedTasks,
          pendingTasks,
          overdueTasks,
          performanceScore,
        }
      } catch (error: any) {
        console.error(`Error calculating metrics for employee ${employee.id}:`, error)
        console.error(`Error stack:`, error?.stack)
        // Return employee with zero metrics if calculation fails
        let createdAtStr: string
        try {
          createdAtStr = employee.createdAt instanceof Date 
            ? employee.createdAt.toISOString() 
            : new Date(employee.createdAt).toISOString()
        } catch {
          createdAtStr = new Date().toISOString()
        }

        let joiningDateStr: string | null = null
        if (employee.joiningDate) {
          try {
            joiningDateStr = employee.joiningDate instanceof Date 
              ? employee.joiningDate.toISOString() 
              : new Date(employee.joiningDate).toISOString()
          } catch {
            joiningDateStr = null
          }
        }

        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          isActive: employee.isActive,
          createdAt: createdAtStr,
          joiningDate: joiningDateStr,
          adminNotes: employee.adminNotes,
          phoneNumber: employee.phoneNumber,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          overdueTasks: 0,
          performanceScore: 0,
        }
      }
    })

    return NextResponse.json({ employees: employeesWithMetrics })
  } catch (error: any) {
    console.error('Error fetching employees:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error message:', error?.message)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
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
    const { name, email, role, joiningDate, password, adminNotes, phoneNumber } = body

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
        phoneNumber: phoneNumber || null,
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

