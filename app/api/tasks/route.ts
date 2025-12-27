export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TaskStatus, TaskPriority, UserRole } from '@prisma/client'
import { createTask } from '@/app/actions/task-actions'

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

    const where: any = {}
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    if (clientId) {
      where.clientId = clientId
    }

    // Super admins can filter by assignedToId or assignedById
    if (assignedToId) {
      where.assignedToId = assignedToId
    }
    if (assignedById) {
      where.assignedById = assignedById
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

