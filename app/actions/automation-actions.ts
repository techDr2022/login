'use server'

import { getServerSession } from 'next-auth'
import { TaskPriority, UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Unauthorized')
  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
    throw new Error('Forbidden')
  }
  return session.user
}

export async function getAutomationData() {
  await requireAdmin()
  const [rules, templates, users, clients, taskTypes] = await Promise.all([
    prisma.recurrencerule.findMany({
      orderBy: { createdat: 'desc' },
      include: {
        client: { select: { name: true } },
        assignee: { select: { name: true } },
        workflow: { select: { name: true } },
        runs: { orderBy: { createdat: 'desc' }, take: 1 },
      },
    }),
    prisma.workflowtemplate.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { stages: { orderBy: { stageorder: 'asc' } } },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.SUPER_ADMIN] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      where: { status: { not: 'PAUSED' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.taskTemplate.findMany({
      where: { isActive: true },
      select: { taskType: true },
      orderBy: { taskType: 'asc' },
    }),
  ])
  return { rules, templates, users, clients, taskTypes }
}

export async function createRecurrenceRule(data: {
  title: string
  description?: string
  priority: TaskPriority
  clientid?: string
  cadence: 'daily' | 'weekly'
  weekday?: number
  assigneeuserid?: string
  tasktype?: string
  workflowtemplateid?: string
}) {
  const user = await requireAdmin()
  const title = data.title.trim()
  if (!title) throw new Error('Title is required')
  if (data.cadence === 'weekly' && (!data.weekday || data.weekday < 1 || data.weekday > 7)) {
    throw new Error('Pick a weekday for a weekly rule')
  }
  await prisma.recurrencerule.create({
    data: {
      title,
      description: data.description?.trim() || null,
      priority: data.priority,
      clientid: data.clientid || null,
      cadence: data.cadence,
      weekday: data.cadence === 'weekly' ? data.weekday : null,
      assigneeuserid: data.workflowtemplateid ? null : data.assigneeuserid || null,
      tasktype: data.workflowtemplateid ? null : data.tasktype || null,
      workflowtemplateid: data.workflowtemplateid || null,
      createdbyid: user.id,
    },
  })
  revalidatePath('/automation')
}

export async function setRecurrenceActive(id: string, active: boolean) {
  await requireAdmin()
  await prisma.recurrencerule.update({ where: { id }, data: { active } })
  revalidatePath('/automation')
}

export async function createWorkflowTemplate(data: {
  name: string
  clientid?: string
  stages: Array<{ title: string; assigneeuserid?: string; tasktype?: string; offsethours?: number }>
}) {
  await requireAdmin()
  const name = data.name.trim()
  const stages = data.stages.map((stage) => ({ ...stage, title: stage.title.trim() })).filter((stage) => stage.title)
  if (!name || stages.length === 0) throw new Error('Name and at least one stage are required')
  await prisma.workflowtemplate.create({
    data: {
      name,
      clientid: data.clientid || null,
      stages: {
        create: stages.map((stage, index) => ({
          stageorder: index + 1,
          title: stage.title,
          assigneeuserid: stage.assigneeuserid || null,
          tasktype: stage.tasktype || null,
          offsethours: stage.offsethours && stage.offsethours > 0 ? stage.offsethours : 24,
        })),
      },
    },
  })
  revalidatePath('/automation')
}
