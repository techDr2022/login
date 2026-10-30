export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { verifyExtensionToken } from '@/lib/extension-auth'
import { EXTENSION_STAFF_ROLES } from '@/lib/rbac'
import { createTaskSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { notifyTaskAssignment } from '@/lib/notification-service'
import { isBeforeIstToday, normalizeTaskDueDate } from '@/lib/attendance-config'
import { Prisma } from '@prisma/client'

function readToken(request: NextRequest): string {
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) throw new Error('Missing bearer token')
  return auth.slice(7)
}

export async function POST(request: NextRequest) {
  let actorId = ''
  let idempotencykey = ''
  try {
    const token = readToken(request)
    const auth = verifyExtensionToken(token)
    const actor = await prisma.user.findUnique({
      where: { id: auth.uid },
      select: { id: true, isActive: true, role: true, name: true },
    })
    if (!actor?.isActive || !EXTENSION_STAFF_ROLES.includes(actor.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    actorId = actor.id
    const body = await request.json()
    idempotencykey =
      typeof body.idempotencykey === 'string' ? body.idempotencykey.trim().slice(0, 120) : ''
    delete body.idempotencykey
    if (idempotencykey) {
      const existing = await prisma.task.findFirst({
        where: { assignedById: actor.id, idempotencykey },
      })
      if (existing) return NextResponse.json(existing)
    }

    if (body.dueDate && typeof body.dueDate === 'string') {
      const parsed = new Date(body.dueDate)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid date format for dueDate' }, { status: 400 })
      }
      body.dueDate = parsed
    }

    if (body.assignedToId) {
      const target = await prisma.user.findUnique({
        where: { id: body.assignedToId },
        select: { id: true, isActive: true, role: true },
      })
      if (!target || !target.isActive || target.role === 'CLIENT') {
        return NextResponse.json({ error: 'Assigned user not found or inactive' }, { status: 400 })
      }
    }
    if (body.clientId) {
      const c = await prisma.client.findUnique({
        where: { id: body.clientId },
        select: { id: true, status: true },
      })
      if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 400 })
      if (c.status === 'PAUSED') {
        return NextResponse.json({ error: 'Cannot assign a task to a paused client' }, { status: 400 })
      }
    }

    const validated = createTaskSchema.parse(body)
    const startDate = new Date()

    let dueDate: Date | undefined
    if (validated.taskType) {
      const template = await prisma.taskTemplate.findUnique({
        where: { taskType: validated.taskType },
        select: { durationHours: true, isActive: true },
      })
      if (!template) {
        return NextResponse.json(
          { error: `Task template not found for type: ${validated.taskType}` },
          { status: 400 }
        )
      }
      if (!template.isActive) {
        return NextResponse.json(
          { error: `Task template is inactive for type: ${validated.taskType}` },
          { status: 400 }
        )
      }
      const calculated = new Date(startDate.getTime() + template.durationHours * 60 * 60 * 1000)
      dueDate = normalizeTaskDueDate(startDate, calculated, template.durationHours)
    } else if (validated.dueDate) {
      dueDate = normalizeTaskDueDate(startDate, new Date(validated.dueDate))
    }

    if (dueDate && isBeforeIstToday(dueDate)) {
      return NextResponse.json({ error: 'Due date cannot be in the past' }, { status: 400 })
    }

    const taskData: any = {
      id: randomUUID(),
      ...validated,
      assignedById: auth.uid,
      status: 'Pending',
      startDate,
      dueDate,
      idempotencykey: idempotencykey || null,
      clientvisible: false,
    }
    if (taskData.assignedToId === '') taskData.assignedToId = null
    if (taskData.clientId === '') taskData.clientId = null
    if (taskData.taskType === '') taskData.taskType = null

    const assignedAt = new Date()
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: taskData,
        include: {
          User_Task_assignedByIdToUser: { select: { name: true } },
          User_Task_assignedToIdToUser: {
            select: { id: true, name: true },
          },
          Client: { select: { name: true } },
        },
      })
      await notifyTaskAssignment(tx, {
        taskId: created.id,
        title: created.title,
        actorId: auth.uid,
        actorName: actor.name,
        nextAssigneeId: created.assignedToId,
        nextAssigneeName: created.User_Task_assignedToIdToUser?.name,
        clientName: created.Client?.name,
        priority: created.priority,
        assignedAt,
      })
      return created
    })

    await logActivity(auth.uid, 'CREATE', 'Task', task.id)

    return NextResponse.json(task, { status: 201 })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && idempotencykey) {
      const existing = await prisma.task.findFirst({
        where: { assignedById: actorId, idempotencykey },
      })
      if (existing) return NextResponse.json(existing)
    }
    if (error?.message?.includes('token') || error?.message?.includes('bearer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Extension create task error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

