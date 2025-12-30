export const dynamic = 'force-dynamic'
export const revalidate = 30 // Revalidate every 30 seconds for better caching

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskPriority, UserRole } from '@prisma/client'
import { createTask } from '@/app/actions/task-actions'
import { canViewAllTasks } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') as TaskStatus | null
    const priority = searchParams.get('priority') as TaskPriority | null
    const clientId = searchParams.get('clientId') || undefined
    const assignedToId = searchParams.get('assignedToId') || undefined
    const assignedById = searchParams.get('assignedById') || undefined

    const userRole = session.user.role as UserRole
    const userId = session.user.id
    const canViewAll = canViewAllTasks(userRole)

    const where: any = {}
    const andConditions: any[] = []
    
    // For non-admin users, only show tasks assigned to them or assigned by them
    if (!canViewAll && userId) {
      andConditions.push({
        OR: [
          { assignedToId: userId },
          { assignedById: userId },
        ]
      })
    }
    
    // Add search filter
    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      })
    }

    // Add other filters
    if (status) {
      andConditions.push({ status })
    }

    if (priority) {
      andConditions.push({ priority })
    }

    if (clientId) {
      andConditions.push({ clientId })
    }

    // Super admins can filter by assignedToId or assignedById
    if (assignedToId && canViewAll) {
      andConditions.push({ assignedToId })
    }
    if (assignedById && canViewAll) {
      andConditions.push({ assignedById })
    }

    // Combine all conditions with AND
    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
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
            },
          },
          Client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.count({ where }),
    ])

    // Transform tasks to map Prisma relation names to expected field names
    const transformedTasks = tasks.map((task: any) => ({
      ...task,
      assignedTo: task.User_Task_assignedToIdToUser || null,
      assignedBy: task.User_Task_assignedByIdToUser || null,
      client: task.Client || null,
    }))

    return NextResponse.json({
      tasks: transformedTasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Session check:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userRole: session?.user?.role,
      })
    }
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Convert dueDate string to Date if provided
    if (body.dueDate && typeof body.dueDate === 'string') {
      const parsedDate = new Date(body.dueDate)
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format for dueDate' },
          { status: 400 }
        )
      }
      body.dueDate = parsedDate
    }

    const task = await createTask(body)

    return NextResponse.json(task, { status: 201 })
  } catch (error: any) {
    console.error('Error creating task:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause,
    })
    
    // Handle validation errors
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    // Handle Prisma errors
    if (error.code) {
      console.error('Prisma error code:', error.code)
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Unique constraint violation' },
          { status: 409 }
        )
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Foreign key constraint violation' },
          { status: 400 }
        )
      }
    }

    // Handle other errors
    const statusCode = error.message?.includes('Unauthorized') 
      ? 401 
      : error.message?.includes('not found') || error.message?.includes('inactive')
      ? 403
      : 500
    
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: statusCode }
    )
  }
}

