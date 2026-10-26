'use server'

import { randomBytes, randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { TaskStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'
import { canTransition, type Actor } from '@/lib/engine/rules'
import { engineEnabled, runScheduler, unlockDependents } from '@/lib/engine/run'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') throw new Error('Unauthorized')
  return session
}

export async function runSchedulerNow() {
  await requireAdmin()
  const result = await runScheduler(new Date())
  revalidatePath('/dashboard')
  revalidatePath('/my-day')
  return result
}

export async function setEngineEnabled(enabled: boolean) {
  await requireAdmin()
  await prisma.appsetting.upsert({
    where: { id: 'NEW_ENGINE_ENABLED' },
    update: { value: enabled ? 'true' : 'false' },
    create: { id: 'NEW_ENGINE_ENABLED', value: enabled ? 'true' : 'false' },
  })
  revalidatePath('/settings')
}

export async function regenerateBoardToken() {
  await requireAdmin()
  const value = randomBytes(24).toString('hex')
  await prisma.appsetting.upsert({
    where: { id: 'PUBLIC_BOARD_TOKEN' },
    update: { value },
    create: { id: 'PUBLIC_BOARD_TOKEN', value },
  })
  revalidatePath('/settings')
  return value
}

export async function updateEngineStatus(
  taskId: string,
  to: string,
  extra?: { waitingName?: string; reason?: string }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Unauthorized')
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { worktemplate: { select: { istimelock: true } } },
  })
  if (!task?.templateid) throw new Error('Task not found')

  const role = session.user.role
  const onTemplate = await prisma.worktemplateassignee.findFirst({
    where: { templateid: task.templateid, userid: session.user.id },
    select: { id: true },
  })
  const isAssignee = task.assignedToId === session.user.id || (!task.assignedToId && !!onTemplate)
  const actor: Actor | null =
    role === 'SUPER_ADMIN' ? 'admin' : role === 'COORDINATOR' ? 'coordinator' : isAssignee ? 'assignee' : null
  if (!actor || !canTransition(task.status, to, actor, !!task.worktemplate?.istimelock)) {
    throw new Error('That status change is not allowed')
  }
  if (task.status === 'Done' && to === 'ToDo' && !extra?.reason?.trim()) {
    throw new Error('A reason is required to reopen')
  }

  let waitingonuserid: string | undefined
  if (to === 'WaitingOnInput') {
    const wanted = extra?.waitingName?.trim().toLowerCase()
    if (!wanted) throw new Error('Name the person you are waiting on')
    const people = await prisma.user.findMany({
      where: { isActive: true, role: { not: 'CLIENT' } },
      select: { id: true, name: true },
    })
    const hits = people.filter((person) => {
      const name = person.name.toLowerCase()
      return name === wanted || name.split(/\s+/)[0] === wanted
    })
    if (hits.length !== 1) throw new Error('Use one exact first name')
    waitingonuserid = hits[0].id
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: to as TaskStatus,
      startedat: to === 'InProgress' ? task.startedat ?? new Date() : undefined,
      assignedToId: to === 'InProgress' && !task.assignedToId ? session.user.id : undefined,
      completedat: to === 'Done' ? new Date() : to === 'ToDo' ? null : undefined,
      approvedbyid: to === 'Done' && (role === 'SUPER_ADMIN' || role === 'COORDINATOR') ? session.user.id : undefined,
      revisioncount: task.status === 'InReview' && to === 'ToDo' ? { increment: 1 } : undefined,
      waitingonuserid,
      noinputflag: to === 'ToDo' ? false : undefined,
    },
  })
  await logActivity(session.user.id, 'STATUS', 'Task', taskId, undefined, {
    oldvalue: task.status,
    newvalue: extra?.reason ? `${to}: ${extra.reason}` : to,
  })
  if (to === 'Done' && (await engineEnabled())) await unlockDependents(taskId, session.user.id)
  revalidatePath('/my-day')
  revalidatePath('/waiting')
  revalidatePath('/blocked')
  revalidatePath('/dashboard')
  revalidatePath(`/tasks/${taskId}`)
  return { id: randomUUID() }
}
