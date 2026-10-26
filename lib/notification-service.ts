import { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

type Db = Prisma.TransactionClient | PrismaClient

export type NotificationWrite = {
  recipientid: string
  actorid?: string | null
  type: string
  entitytype: string
  entityid: string
  title: string
  message: string
  data?: Prisma.InputJsonValue
  link?: string | null
  priority?: string
  groupkey?: string | null
  idempotencykey: string
}

export async function createNotification(db: Db, input: NotificationWrite) {
  const id = randomUUID()
  const dataJson = input.data === undefined ? null : JSON.stringify(input.data)
  try {
    const inserted = await db.$executeRawUnsafe(
      `INSERT INTO "Notification" (
        "id", "recipientid", "actorid", "type", "entitytype", "entityid",
        "title", "message", "data", "link", "priority", "groupkey", "idempotencykey"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
      ON CONFLICT ("idempotencykey") DO NOTHING`,
      id,
      input.recipientid,
      input.actorid || null,
      input.type,
      input.entitytype,
      input.entityid,
      input.title,
      input.message,
      dataJson,
      input.link || null,
      input.priority || 'normal',
      input.groupkey || null,
      input.idempotencykey
    )
    return inserted > 0 ? { id } : null
  } catch (error) {
    console.error('[Notifications] Create failed', {
      type: input.type,
      recipientid: input.recipientid,
      entityid: input.entityid,
      error,
    })
    throw error
  }
}

function formatAssignedAt(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export async function notifyTaskAssignment(
  db: Db,
  input: {
    taskId: string
    title: string
    actorId: string
    actorName: string
    previousAssigneeId?: string | null
    nextAssigneeId?: string | null
    nextAssigneeName?: string | null
    clientName?: string | null
    priority?: string | null
    assignedAt?: Date
  }
) {
  const assignedAt = input.assignedAt || new Date()
  const when = formatAssignedAt(assignedAt)
  const stamp = assignedAt.toISOString()
  const details = [input.clientName, input.priority ? `${input.priority} priority` : '']
    .filter(Boolean)
    .join(' • ')
  const priority = input.priority === 'Urgent' || input.priority === 'High' ? 'high' : 'normal'

  if (input.nextAssigneeId && input.nextAssigneeId !== input.actorId) {
    await createNotification(db, {
      recipientid: input.nextAssigneeId,
      actorid: input.actorId,
      type: 'task_assigned',
      entitytype: 'Task',
      entityid: input.taskId,
      title: 'Task assigned to you',
      message: [`"${input.title}"`, `Assigned by ${input.actorName}`, details, when]
        .filter(Boolean)
        .join('\n'),
      link: `/tasks/${input.taskId}`,
      priority,
      groupkey: `task:${input.taskId}`,
      idempotencykey: `${input.taskId}:task_assigned:${input.nextAssigneeId}:${stamp}`,
      data: {
        title: input.title,
        actorName: input.actorName,
        assigneeName: input.nextAssigneeName || null,
        clientName: input.clientName || null,
        priority: input.priority || null,
        assignedAt: stamp,
      },
    })
  }

  const previousId = input.previousAssigneeId || null
  const nextId = input.nextAssigneeId || null
  if (!previousId || previousId === nextId || previousId === input.actorId) return

  const removed = !nextId
  await createNotification(db, {
    recipientid: previousId,
    actorid: input.actorId,
    type: removed ? 'task_unassigned' : 'task_reassigned',
    entitytype: 'Task',
    entityid: input.taskId,
    title: removed ? 'Task unassigned' : 'Task reassigned',
    message: [
      `"${input.title}"`,
      removed
        ? `${input.actorName} removed you from this task`
        : `${input.actorName} reassigned this task to ${input.nextAssigneeName || 'someone else'}`,
      when,
    ].join('\n'),
    link: `/tasks/${input.taskId}`,
    priority: 'normal',
    groupkey: `task:${input.taskId}`,
    idempotencykey: `${input.taskId}:${removed ? 'task_unassigned' : 'task_reassigned'}:${previousId}:${stamp}`,
    data: {
      title: input.title,
      actorName: input.actorName,
      assigneeName: input.nextAssigneeName || null,
      assignedAt: stamp,
    },
  })
}
