'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { logActivity } from '@/lib/activity-log'
import { UserRole } from '@prisma/client'

// Helper to check if user is Admin or Super Admin
function canManageTaskTemplates(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN || role === UserRole.MANAGER
}

async function checkAuth() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  if (!canManageTaskTemplates(session.user.role as UserRole)) {
    throw new Error('Forbidden: Only Admin/Super Admin can manage task templates')
  }
  return session
}

export async function getAllTaskTemplates() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  const templates = await prisma.taskTemplate.findMany({
    orderBy: { taskType: 'asc' },
  })

  return templates
}

export async function getTaskTemplate(taskType: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  const template = await prisma.taskTemplate.findUnique({
    where: { taskType },
  })

  return template
}

export async function createTaskTemplate(data: {
  taskType: string
  durationHours: number
  isActive?: boolean
}) {
  const session = await checkAuth()

  // Check if taskType already exists
  const existing = await prisma.taskTemplate.findUnique({
    where: { taskType: data.taskType },
  })

  if (existing) {
    throw new Error(`Task template with type "${data.taskType}" already exists`)
  }

  const template = await prisma.taskTemplate.create({
    data: {
      id: randomUUID(),
      taskType: data.taskType,
      durationHours: data.durationHours,
      isActive: data.isActive ?? true,
    },
  })

  await logActivity(session.user.id, 'CREATE', 'TaskTemplate', template.id)

  return template
}

export async function updateTaskTemplate(taskType: string, data: {
  durationHours?: number
  isActive?: boolean
}) {
  const session = await checkAuth()

  const existing = await prisma.taskTemplate.findUnique({
    where: { taskType },
  })

  if (!existing) {
    throw new Error(`Task template with type "${taskType}" not found`)
  }

  const template = await prisma.taskTemplate.update({
    where: { taskType },
    data: {
      ...(data.durationHours !== undefined && { durationHours: data.durationHours }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'TaskTemplate', template.id)

  return template
}

export async function deleteTaskTemplate(taskType: string) {
  const session = await checkAuth()

  const existing = await prisma.taskTemplate.findUnique({
    where: { taskType },
  })

  if (!existing) {
    throw new Error(`Task template with type "${taskType}" not found`)
  }

  await prisma.taskTemplate.delete({
    where: { taskType },
  })

  await logActivity(session.user.id, 'DELETE', 'TaskTemplate', taskType)

  return { success: true }
}

