import { randomUUID } from 'crypto'
import { Prisma, TaskPriority } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'
import { notifyTaskAssignment } from '@/lib/notification-service'
import {
  endOfBusinessDayIST,
  getAttendanceDateForDB,
  getISTDateKey,
  normalizeTaskDueDate,
} from '@/lib/attendance-config'
import { istWeekday, weekContaining } from '@/lib/ist-week'

type StageInput = {
  title: string
  tasktype: string | null
  offsethours: number
  assigneeuserid: string | null
  stageorder: number
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export async function resolveAssignee(userId: string | null, dueDate: Date) {
  if (!userId) return { assigneeId: null as string | null, note: null as string | null }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, role: true },
  })
  if (!user || !user.isActive || user.role === 'CLIENT') {
    return { assigneeId: null, note: 'Assignee is inactive' }
  }
  const leave = await prisma.attendances.findFirst({
    where: {
      userId,
      mode: 'LEAVE',
      date: getAttendanceDateForDB(dueDate),
    },
    select: { id: true },
  })
  if (leave) return { assigneeId: null, note: 'Assignee is on leave' }
  return { assigneeId: user.id, note: null }
}

async function dueForStage(start: Date, tasktype: string | null, offsethours: number) {
  if (tasktype) {
    const template = await prisma.taskTemplate.findUnique({
      where: { taskType: tasktype },
      select: { durationHours: true, isActive: true },
    })
    if (template?.isActive) {
      const candidate = new Date(start.getTime() + template.durationHours * 60 * 60 * 1000)
      return normalizeTaskDueDate(start, candidate, template.durationHours)
    }
  }
  const candidate = new Date(start.getTime() + Math.max(offsethours, 0) * 60 * 60 * 1000)
  return normalizeTaskDueDate(start, candidate, offsethours)
}

async function insertTask(input: {
  title: string
  description?: string | null
  priority: TaskPriority
  assignedById: string
  assignedToId: string | null
  clientId: string | null
  tasktype: string | null
  dueDate: Date
  workflowrunid?: string | null
  workflowtemplateid?: string | null
  stageorder?: number | null
  dependstaskid?: string | null
  recurrenceperiodkey?: string | null
  note?: string | null
}) {
  const description = [input.description, input.note].filter(Boolean).join('\n') || null
  const assignedAt = new Date()
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        id: randomUUID(),
        title: input.title,
        description,
        priority: input.priority,
        status: 'Pending',
        assignedById: input.assignedById,
        assignedToId: input.assignedToId,
        clientId: input.clientId,
        taskType: input.tasktype,
        startDate: assignedAt,
        dueDate: input.dueDate,
        workflowrunid: input.workflowrunid,
        workflowtemplateid: input.workflowtemplateid,
        stageorder: input.stageorder,
        dependstaskid: input.dependstaskid,
        recurrenceperiodkey: input.recurrenceperiodkey,
        clientvisible: false,
      },
    })
    if (created.assignedToId) {
      const [actor, assignee] = await Promise.all([
        tx.user.findUnique({ where: { id: input.assignedById }, select: { name: true } }),
        tx.user.findUnique({ where: { id: created.assignedToId }, select: { name: true } }),
      ])
      const client = created.clientId
        ? await tx.client.findUnique({ where: { id: created.clientId }, select: { name: true } })
        : null
      await notifyTaskAssignment(tx, {
        taskId: created.id,
        title: created.title,
        actorId: input.assignedById,
        actorName: actor?.name || 'Someone',
        nextAssigneeId: created.assignedToId,
        nextAssigneeName: assignee?.name,
        clientName: client?.name,
        priority: created.priority,
        assignedAt,
      })
    }
    return created
  })
  await logActivity(input.assignedById, 'CREATE', 'Task', task.id)
  return task
}

export async function advanceWorkflow(completed: {
  id: string
  clientId: string | null
  assignedById: string
  workflowtemplateid: string | null
  workflowrunid: string | null
  stageorder: number | null
}) {
  if (!completed.workflowtemplateid || !completed.workflowrunid || completed.stageorder == null) return

  const next = await prisma.workflowstage.findFirst({
    where: {
      templateid: completed.workflowtemplateid,
      stageorder: { gt: completed.stageorder },
    },
    orderBy: { stageorder: 'asc' },
  })
  if (!next) return

  const existing = await prisma.task.findFirst({
    where: { workflowrunid: completed.workflowrunid, stageorder: next.stageorder },
    select: { id: true },
  })
  if (existing) return

  const client = completed.clientId
    ? await prisma.client.findUnique({
        where: { id: completed.clientId },
        select: { name: true },
      })
    : null
  const start = new Date()
  const dueDate = await dueForStage(start, next.tasktype, next.offsethours)
  const assignee = await resolveAssignee(next.assigneeuserid, dueDate)
  const title = client ? `${next.title} for ${client.name}` : next.title

  await insertTask({
    title,
    description: next.title,
    priority: 'Medium',
    assignedById: completed.assignedById,
    assignedToId: assignee.assigneeId,
    clientId: completed.clientId,
    tasktype: next.tasktype,
    dueDate,
    workflowrunid: completed.workflowrunid,
    workflowtemplateid: completed.workflowtemplateid,
    stageorder: next.stageorder,
    dependstaskid: completed.id,
    note: assignee.note,
  })
}

function periodKeyForRule(cadence: string, weekday: number | null, now: Date) {
  if (cadence === 'daily') return getISTDateKey(now)
  if (cadence === 'weekly' && weekday && istWeekday(now) === weekday) {
    return weekContaining(now).weekstartKey
  }
  return null
}

async function createFromRule(rule: {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  tasktype: string | null
  assigneeuserid: string | null
  clientid: string | null
  createdbyid: string
  workflowtemplateid: string | null
  workflow: { stages: StageInput[] } | null
}, periodkey: string) {
  const client = rule.clientid
    ? await prisma.client.findUnique({ where: { id: rule.clientid }, select: { id: true, name: true, status: true } })
    : null
  if (rule.clientid && (!client || client.status === 'PAUSED')) {
    return { taskid: null, status: 'skipped', error: 'Client is paused or missing' }
  }

  const marker = `${rule.id}:${periodkey}`
  const already = await prisma.task.findFirst({
    where: { recurrenceperiodkey: marker },
    select: { id: true },
  })
  if (already) return { taskid: already.id, status: 'created', error: null }

  const start = new Date()
  const stages = [...(rule.workflow?.stages || [])].sort((a, b) => a.stageorder - b.stageorder)
  const first = rule.workflowtemplateid ? stages[0] : null
  if (rule.workflowtemplateid && !first) {
    return { taskid: null, status: 'failed', error: 'Workflow has no stages' }
  }

  const tasktype = first?.tasktype || rule.tasktype
  const offsethours = first?.offsethours ?? 8
  const dueDate = tasktype || first
    ? await dueForStage(start, tasktype, offsethours)
    : endOfBusinessDayIST(start)
  const assignee = await resolveAssignee(first?.assigneeuserid || rule.assigneeuserid, dueDate)
  const workflowrunid = first ? randomUUID() : null
  const title = first
    ? client ? `${first.title} for ${client.name}` : first.title
    : rule.title

  const task = await insertTask({
    title,
    description: rule.description,
    priority: rule.priority,
    assignedById: rule.createdbyid,
    assignedToId: assignee.assigneeId,
    clientId: client?.id || null,
    tasktype,
    dueDate,
    workflowrunid,
    workflowtemplateid: first ? rule.workflowtemplateid : null,
    stageorder: first?.stageorder ?? null,
    recurrenceperiodkey: marker,
    note: assignee.note,
  })
  return { taskid: task.id, status: 'created', error: assignee.note }
}

export async function runDueRecurrence(now = new Date()) {
  const rules = await prisma.recurrencerule.findMany({
    where: { active: true },
    include: {
      workflow: {
        include: { stages: { orderBy: { stageorder: 'asc' } } },
      },
    },
  })

  const failed = await prisma.recurrencerun.findMany({
    where: { status: 'failed', taskid: null },
    include: {
      rule: {
        include: { workflow: { include: { stages: { orderBy: { stageorder: 'asc' } } } } },
      },
    },
  })

  let created = 0
  let skipped = 0
  let errors = 0

  for (const rule of rules) {
    const periodkey = periodKeyForRule(rule.cadence, rule.weekday, now)
    if (!periodkey) continue
    const outcome = await ensureRun(rule, periodkey)
    if (outcome === 'created') created += 1
    else if (outcome === 'skipped') skipped += 1
    else if (outcome === 'failed') errors += 1
  }

  for (const run of failed) {
    if (!run.rule.active) continue
    const outcome = await ensureRun(run.rule, run.periodkey, run.id)
    if (outcome === 'created') created += 1
    else if (outcome === 'failed') errors += 1
  }

  return { created, skipped, errors, checked: rules.length }
}

async function ensureRun(
  rule: {
    id: string
    title: string
    description: string | null
    priority: TaskPriority
    tasktype: string | null
    assigneeuserid: string | null
    clientid: string | null
    createdbyid: string
    workflowtemplateid: string | null
    workflow: { stages: StageInput[] } | null
  },
  periodkey: string,
  existingRunId?: string
) {
  let runId = existingRunId
  if (runId) {
    const current = await prisma.recurrencerun.findUnique({ where: { id: runId } })
    if (!current || current.taskid || current.status === 'created') return 'skipped'
  }
  if (!runId) {
    try {
      const run = await prisma.recurrencerun.create({
        data: { ruleid: rule.id, periodkey, status: 'pending' },
      })
      runId = run.id
    } catch (error) {
      if (!isUniqueConflict(error)) throw error
      const existing = await prisma.recurrencerun.findUnique({
        where: { ruleid_periodkey: { ruleid: rule.id, periodkey } },
      })
      if (!existing || existing.taskid || existing.status !== 'failed') return 'skipped'
      runId = existing.id
    }
  }

  try {
    const result = await createFromRule(rule, periodkey)
    await prisma.recurrencerun.update({
      where: { id: runId },
      data: { taskid: result.taskid, status: result.status, error: result.error },
    })
    return result.status === 'created' ? 'created' : result.status === 'failed' ? 'failed' : 'skipped'
  } catch (error) {
    await prisma.recurrencerun.update({
      where: { id: runId },
      data: { status: 'failed', error: error instanceof Error ? error.message : 'Task creation failed' },
    })
    return 'failed'
  }
}
