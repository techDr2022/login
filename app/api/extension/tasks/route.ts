export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { verifyExtensionToken } from '@/lib/extension-auth'
import { createTaskSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import {
  formatTaskAssignmentMessage,
  getTaskAssignmentTemplateVariables,
  getTaskWhatsAppContentTemplateSid,
  sendWhatsAppNotification,
} from '@/lib/whatsapp'

function readToken(request: NextRequest): string {
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) throw new Error('Missing bearer token')
  return auth.slice(7)
}

export async function POST(request: NextRequest) {
  try {
    const token = readToken(request)
    const auth = verifyExtensionToken(token)
    const body = await request.json()

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
        select: { id: true, isActive: true },
      })
      if (!target || !target.isActive) {
        return NextResponse.json({ error: 'Assigned user not found or inactive' }, { status: 400 })
      }
    }
    if (body.clientId) {
      const c = await prisma.client.findUnique({
        where: { id: body.clientId },
        select: { id: true },
      })
      if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 400 })
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
      if (template.durationHours >= 24 || calculated.getDate() !== startDate.getDate()) {
        calculated.setHours(18, 0, 0, 0)
      }
      dueDate = calculated
    } else if (validated.dueDate) {
      const provided = new Date(validated.dueDate)
      if (provided.getHours() === 0 || provided.getHours() < 9) {
        provided.setHours(18, 0, 0, 0)
      }
      dueDate = provided
    }

    if (dueDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dueDateOnly = new Date(dueDate)
      dueDateOnly.setHours(0, 0, 0, 0)
      if (dueDateOnly < today) {
        return NextResponse.json({ error: 'Due date cannot be in the past' }, { status: 400 })
      }
    }

    const taskData: any = {
      id: randomUUID(),
      ...validated,
      assignedById: auth.uid,
      status: 'Pending',
      startDate,
      dueDate,
    }
    if (taskData.assignedToId === '') taskData.assignedToId = null
    if (taskData.clientId === '') taskData.clientId = null
    if (taskData.taskType === '') taskData.taskType = null

    const task = await prisma.task.create({
      data: taskData,
      include: {
        User_Task_assignedByIdToUser: { select: { name: true } },
        User_Task_assignedToIdToUser: {
          select: { id: true, name: true, phoneNumber: true, notifyTaskUpdates: true },
        },
        Client: { select: { name: true } },
      },
    })

    await logActivity(auth.uid, 'CREATE', 'Task', task.id)

    if (task.assignedToId && task.User_Task_assignedToIdToUser) {
      const assignedToUser = task.User_Task_assignedToIdToUser
      if (assignedToUser.phoneNumber && assignedToUser.notifyTaskUpdates) {
        try {
          const message = formatTaskAssignmentMessage(
            task.title,
            task.User_Task_assignedByIdToUser.name,
            task.priority,
            task.dueDate || undefined,
            task.Client?.name
          )
          const templateVars = getTaskAssignmentTemplateVariables(
            task.title,
            task.User_Task_assignedByIdToUser.name,
            task.priority,
            task.dueDate || undefined,
            task.Client?.name
          )
          await sendWhatsAppNotification(
            assignedToUser.phoneNumber,
            message,
            templateVars,
            undefined,
            getTaskWhatsAppContentTemplateSid()
          )
        } catch (err) {
          console.error('Extension task WhatsApp notify failed:', err)
        }
      }
    }

    return NextResponse.json(task, { status: 201 })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error?.message?.includes('token') || error?.message?.includes('bearer')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Extension create task error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

