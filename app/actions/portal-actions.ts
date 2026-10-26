'use server'

import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { ClientRequestType, UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'
import { canManageClients } from '@/lib/rbac'
import { createTask } from '@/app/actions/task-actions'
import { buildWeeklyReport } from '@/lib/weekly-report'
import { revalidatePath } from 'next/cache'

const CLIENT_LOGIN_DOMAIN = 'client.login'

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

export async function createPortalLogin(data: {
  clientId: string
  name: string
  username: string
  password: string
}) {
  const staff = await requireStaffClient(data.clientId)
  const name = data.name.trim()
  const username = normalizeUsername(data.username)
  if (!name || !/^[a-z0-9._-]{3,32}$/.test(username) || data.password.length < 6) {
    throw new Error('Name, a username of 3–32 letters or numbers, and a password of at least 6 characters are required')
  }
  const email = `${username}@${CLIENT_LOGIN_DOMAIN}`
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  })
  if (existing && existing.role !== UserRole.CLIENT) {
    throw new Error('That username already belongs to a staff account')
  }
  const passwordHash = await bcrypt.hash(data.password, 10)
  const userId = existing
    ? (
        await prisma.user.update({
          where: { id: existing.id },
          data: { name, username, email, passwordHash, isActive: true, role: UserRole.CLIENT },
          select: { id: true },
        })
      ).id
    : (
        await prisma.user.create({
          data: {
            id: randomUUID(),
            name,
            email,
            username,
            passwordHash,
            role: UserRole.CLIENT,
            isActive: true,
          },
          select: { id: true },
        })
      ).id
  if (!existing) await logActivity(staff.id, 'CREATE', 'User', userId)
  const access = await prisma.clientportalaccess.upsert({
    where: { userid_clientid: { userid: userId, clientid: data.clientId } },
    create: { userid: userId, clientid: data.clientId },
    update: {},
    select: { id: true },
  })
  return { id: access.id, name, username }
}

async function sessionUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user
}

export async function canStaffClient(_clientId: string) {
  const user = await sessionUser()
  return canManageClients(user.role as UserRole)
}

async function requireStaffClient(clientId: string) {
  const user = await sessionUser()
  if (!(await canStaffClient(clientId))) throw new Error('Forbidden')
  return user
}

export async function getPortalHome() {
  const user = await sessionUser()
  if (user.role !== UserRole.CLIENT) throw new Error('Forbidden')
  const access = await prisma.clientportalaccess.findMany({
    where: { userid: user.id },
    include: {
      client: { select: { id: true, name: true, doctorOrHospitalName: true } },
    },
    orderBy: { createdat: 'asc' },
  })
  const clientIds = access.map((row) => row.clientid)
  const tasks = clientIds.length
    ? await prisma.task.findMany({
        where: { clientId: { in: clientIds }, status: { notIn: ['Rejected', 'Cancelled'] } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          deliverableurl: true,
          clientId: true,
          worktemplate: { select: { section: true } },
        },
      })
    : []
  return {
    clients: access.map((row) => row.client),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      deliverableurl: task.deliverableurl,
      clientId: task.clientId,
      category: task.worktemplate?.section?.trim() || 'Other',
    })),
  }
}

export async function submitPortalRequest(data: {
  clientId: string
  requestType: ClientRequestType
  summary: string
  notes?: string
}) {
  const user = await sessionUser()
  if (user.role !== UserRole.CLIENT) throw new Error('Forbidden')
  const summary = data.summary.trim()
  if (!summary) throw new Error('Describe the request')
  const access = await prisma.clientportalaccess.findUnique({
    where: { userid_clientid: { userid: user.id, clientid: data.clientId } },
    include: { client: { select: { name: true, phoneWhatsApp: true } } },
  })
  if (!access) throw new Error('Forbidden')

  const row = await prisma.clientRequest.create({
    data: {
      source: 'portal',
      clientId: data.clientId,
      clientName: access.client.name,
      contactPhone: access.client.phoneWhatsApp,
      requestType: data.requestType,
      summary,
      notes: data.notes?.trim() || null,
      createdById: user.id,
    },
  })
  revalidatePath('/portal')
  revalidatePath('/client-requests')
  return { id: row.id }
}

export async function setClientTasksVisible(
  clientId: string,
  clientvisible: boolean,
  taskIds: string[] | 'all'
) {
  const staff = await requireStaffClient(clientId)
  if (taskIds !== 'all' && taskIds.length === 0) return { count: 0 }
  const result = await prisma.task.updateMany({
    where: taskIds === 'all' ? { clientId } : { clientId, id: { in: taskIds } },
    data: { clientvisible },
  })
  await logActivity(staff.id, 'UPDATE', 'Client', clientId)
  return { count: result.count }
}

export async function setTaskClientVisible(taskId: string, clientvisible: boolean, deliverableurl?: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, clientId: true },
  })
  if (!task?.clientId) throw new Error('Link the task to a client before sharing it')
  const staff = await requireStaffClient(task.clientId)
  await prisma.task.update({
    where: { id: taskId },
    data: {
      clientvisible,
      ...(deliverableurl !== undefined ? { deliverableurl: deliverableurl.trim() || null } : {}),
    },
  })
  await logActivity(staff.id, 'UPDATE', 'Task', taskId)
}

export async function convertClientRequestToTask(requestId: string) {
  const user = await sessionUser()
  if (user.role === UserRole.CLIENT) throw new Error('Forbidden')
  const request = await prisma.clientRequest.findUnique({
    where: { id: requestId },
    include: { assignees: { select: { userId: true }, take: 1 } },
  })
  if (!request) throw new Error('Request not found')
  if (!request.clientId) throw new Error('Link the request to a client before creating a task')
  if (!(await canStaffClient(request.clientId)) && user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Forbidden')
  }

  const existing = await prisma.task.findFirst({
    where: { clientrequestid: requestId },
    select: { id: true },
  })
  if (existing) return { taskId: existing.id }

  const task = await createTask({
    title: request.summary.slice(0, 200),
    description: request.notes || request.summary,
    priority: 'Medium',
    assignedToId: request.assignees[0]?.userId,
    clientId: request.clientId,
  })
  await prisma.task.update({
    where: { id: task.id },
    data: { clientrequestid: requestId },
  })
  if (request.status === 'NEW') {
    await prisma.clientRequest.update({
      where: { id: requestId },
      data: { status: 'IN_PROGRESS' },
    })
  }
  revalidatePath('/client-requests')
  revalidatePath('/tasks')
  return { taskId: task.id }
}

export async function generateClientWeekReport(clientId: string, fromKey: string, toKey: string) {
  await requireStaffClient(clientId)
  const report = await buildWeeklyReport(clientId, fromKey, toKey)
  return { id: report.id, weekstart: report.weekstart.toISOString(), weekend: report.weekend.toISOString() }
}

export async function getClientPortalAdmin(clientId: string) {
  await requireStaffClient(clientId)
  const [logins, tasks, reports, taskTotal, taskShared] = await Promise.all([
    prisma.clientportalaccess.findMany({
      where: { clientid: clientId },
      include: { user: { select: { id: true, name: true, email: true, username: true, isActive: true } } },
      orderBy: { createdat: 'desc' },
    }),
    prisma.task.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        status: true,
        clientvisible: true,
        deliverableurl: true,
        dueDate: true,
      },
    }),
    prisma.clientweeklyreport.findMany({
      where: { clientid: clientId },
      orderBy: { weekstart: 'desc' },
      take: 12,
      select: { id: true, weekstart: true, weekend: true, status: true },
    }),
    prisma.task.count({ where: { clientId } }),
    prisma.task.count({ where: { clientId, clientvisible: true } }),
  ])
  return { logins, tasks, reports, taskTotal, taskShared }
}
