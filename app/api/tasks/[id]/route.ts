export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

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

    const task = await prisma.task.findUnique({
      where: { id },
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
            email: true,
          },
        },
        Client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Employees can only see their own tasks
    // If task is not assigned (assignedToId is null), employees cannot see it
    if (session.user.role === UserRole.EMPLOYEE) {
      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Task access check:', {
          taskId: task.id,
          taskAssignedToId: task.assignedToId,
          sessionUserId: session.user.id,
          userIdsMatch: task.assignedToId === session.user.id,
          taskAssignedTo: task.User_Task_assignedToIdToUser?.name || 'N/A',
        })
      }
      
      if (!task.assignedToId) {
        return NextResponse.json({ 
          error: 'This task is not assigned to anyone. Please contact your manager to assign it.' 
        }, { status: 403 })
      }
      
      if (task.assignedToId !== session.user.id) {
        return NextResponse.json({ 
          error: `You do not have permission to view this task. This task is assigned to ${task.User_Task_assignedToIdToUser?.name || 'another user'}.` 
        }, { status: 403 })
      }
    }

    // Transform task to map Prisma relation names to expected field names
    const transformedTask = {
      ...task,
      assignedTo: task.User_Task_assignedToIdToUser || null,
      assignedBy: task.User_Task_assignedByIdToUser || null,
      client: task.Client || null,
    }

    return NextResponse.json(transformedTask)
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

