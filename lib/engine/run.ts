import { randomUUID } from 'crypto'
import { TaskPriority, TaskStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'
import { createNotification } from '@/lib/notification-service'
import { dateAtISTWallClock, getISTDateKey } from '@/lib/attendance-config'
import {
  dueClock,
  escalationTarget,
  initialStatus,
  istDateKey,
  planInstances,
  topoTemplates,
  workingDaysAfter,
  type DepLink,
  type PlannedInstance,
  type ScopeInstance,
  type TemplatePlan,
} from '@/lib/engine/rules'

const OPEN = ['Locked', 'ToDo', 'InProgress', 'WaitingOnInput', 'InReview', 'Pending', 'Review'] as TaskStatus[]

type TemplateRow = {
  id: string
  title: string
  section: string | null
  triggertype: string
  repeat: string | null
  timeorday: string | null
  priority: string
  perclient: boolean
  istimelock: boolean
  donewhen: string | null
  inputneeded: string | null
  assignees: Array<{ userid: string }>
  dependencies: DepLink[]
}

export async function engineEnabled() {
  const row = await prisma.appsetting.findUnique({ where: { id: 'NEW_ENGINE_ENABLED' } })
  return row?.value === 'true'
}

async function holidaySet() {
  const rows = await prisma.attendance_holidays.findMany({ select: { date: true } })
  return new Set(rows.map((row) => row.date.toISOString().slice(0, 10)))
}

async function actorId() {
  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  if (!admin) throw new Error('No active admin')
  return admin.id
}

function priorityOf(value: string): TaskPriority {
  if (value === 'Low' || value === 'High' || value === 'Urgent') return value
  return 'Medium'
}

function atMinutes(dateKey: string, minutes: number) {
  return dateAtISTWallClock(dateKey, Math.floor(minutes / 60), minutes % 60)
}

async function loadTemplates(): Promise<TemplateRow[]> {
  const rows = await prisma.worktemplate.findMany({
    where: { active: true },
    include: {
      assignees: { select: { userid: true } },
      dependencies: { select: { dependsonid: true, kind: true, mode: true } },
    },
  })
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    section: row.section,
    triggertype: row.triggertype,
    repeat: row.repeat,
    timeorday: row.timeorday,
    priority: row.priority,
    perclient: row.perclient,
    istimelock: row.istimelock,
    donewhen: row.donewhen,
    inputneeded: row.inputneeded,
    assignees: row.assignees,
    dependencies: row.dependencies.map((dep) => ({
      dependsonid: dep.dependsonid,
      kind: dep.kind,
      mode: dep.mode === 'any' ? 'any' : 'all',
    })),
  }))
}

export async function runScheduler(now = new Date()) {
  if (!(await engineEnabled())) return { created: 0, skipped: 0, errors: 'engine disabled' }
  const todayKey = getISTDateKey(now)
  const holidays = await holidaySet()
  const templates = await loadTemplates()
  const plans: TemplatePlan[] = templates.map((template) => ({
    id: template.id,
    repeat: template.repeat || '',
    timeorday: template.timeorday,
    section: template.section,
    triggertype: template.triggertype,
    perclient: template.perclient,
    assigneeIds: template.assignees.map((assignee) => assignee.userid),
  }))
  const clients = await prisma.client.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, accountManagerId: true },
  })
  const planned = planInstances({
    templates: plans,
    clients: clients.map((client) => ({ id: client.id, ownerid: client.accountManagerId })),
    todayKey,
    holidays,
  })
  const existing = new Set(
    (
      await prisma.task.findMany({
        where: { enginekey: { in: planned.map((item) => item.enginekey) } },
        select: { enginekey: true },
      })
    ).map((row) => row.enginekey)
  )
  const missing = planned.filter((item) => !existing.has(item.enginekey))
  const byTemplate = new Map(templates.map((template) => [template.id, template]))
  const order = topoTemplates(
    templates.map((template) => template.id),
    templates.flatMap((template) => template.dependencies.map((dep) => [template.id, dep.dependsonid] as [string, string]))
  )
  const dependencyIds = [...new Set(templates.flatMap((template) => template.dependencies.map((dep) => dep.dependsonid)))]
  const pool: ScopeInstance[] = (
    await prisma.task.findMany({
      where: {
        templateid: { in: dependencyIds },
        status: { in: ['Done', 'Locked', 'ToDo', 'InProgress', 'WaitingOnInput', 'InReview'] },
      },
      select: { templateid: true, status: true, dueDate: true, clientId: true, projectid: true, periodkey: true, assignedToId: true },
    })
  ).map((row) => ({
    templateid: row.templateid as string,
    status: row.status,
    dueat: row.dueDate?.getTime() ?? 0,
    clientid: row.clientId,
    projectid: row.projectid,
    periodkey: row.periodkey || '',
    assigneeid: row.assignedToId,
  }))
  const actor = await actorId()
  const errors: string[] = []
  let created = 0
  const fresh: Array<{ assigneeid: string | null; status: string; templateid: string }> = []

  for (const templateid of order) {
    const batch = missing.filter((item) => item.templateid === templateid)
    const template = byTemplate.get(templateid)
    if (!template || !batch.length) continue
    try {
      const rows = batch.map((item) => buildRow(item, template, actor, pool))
      for (let index = 0; index < rows.length; index += 200) {
        const slice = rows.slice(index, index + 200)
        await prisma.task.createMany({ data: slice })
        created += slice.length
      }
      for (const item of batch) {
        const row = rows.find((candidate) => candidate.enginekey === item.enginekey)
        if (!row) continue
        pool.push({
          templateid,
          status: row.status,
          dueat: row.dueDate?.getTime() ?? 0,
          clientid: item.clientid,
          projectid: null,
          periodkey: item.periodkey,
          assigneeid: item.assigneeid,
        })
        fresh.push({ assigneeid: item.assigneeid, status: row.status, templateid })
      }
    } catch (error) {
      errors.push(`${templateid}: ${error instanceof Error ? error.message : 'failed'}`)
    }
  }

  await notifyGroups(actor, todayKey, fresh)
  await prisma.enginerun.create({
    data: {
      id: randomUUID(),
      kind: 'schedule',
      created,
      skipped: planned.length - missing.length,
      errors: errors.join('\n') || null,
    },
  })
  return { created, skipped: planned.length - missing.length, errors: errors.join('\n') }
}

function buildRow(item: PlannedInstance, template: TemplateRow, actor: string, pool: ScopeInstance[]) {
  const clock = dueClock(template.timeorday)
  const dueDate = atMinutes(item.dueKey, clock.due)
  const sameTeam = template.dependencies.filter((dep) => dep.kind === 'same-team')
  const crossTeam = template.dependencies.filter((dep) => dep.kind === 'cross-team')
  const opening = initialStatus({
    istimelock: template.istimelock,
    triggertype: template.triggertype,
    sameTeam,
    crossTeam,
    pool,
    task: {
      clientid: item.clientid,
      projectid: null,
      periodkey: item.periodkey,
      dueat: dueDate.getTime(),
    },
  })
  const provider = crossTeam.length === 1
    ? pool.find((entry) => entry.templateid === crossTeam[0].dependsonid && entry.periodkey === item.periodkey && entry.clientid === item.clientid)
    : undefined
  return {
    id: randomUUID(),
    title: template.title,
    description: [template.donewhen, template.inputneeded].filter(Boolean).join('\n') || null,
    priority: priorityOf(template.priority),
    status: opening.status as TaskStatus,
    assignedById: actor,
    assignedToId: item.assigneeid,
    clientId: item.clientid,
    taskType: template.id,
    startDate: atMinutes(item.dueKey, clock.start),
    dueDate,
    templateid: template.id,
    periodkey: item.periodkey,
    revisioncount: 0,
    noinputflag: opening.noinputflag,
    waitingonuserid: opening.status === 'WaitingOnInput' ? provider?.assigneeid ?? null : null,
    enginekey: item.enginekey,
    idempotencykey: item.enginekey,
    clientvisible: false,
  }
}

async function notifyGroups(
  actor: string,
  todayKey: string,
  fresh: Array<{ assigneeid: string | null; status: string; templateid: string }>
) {
  const counts = new Map<string, number>()
  for (const row of fresh) {
    if (!row.assigneeid || row.status === 'Locked') continue
    counts.set(row.assigneeid, (counts.get(row.assigneeid) ?? 0) + 1)
  }
  for (const [userid, count] of counts) {
    await createNotification(prisma, {
      recipientid: userid,
      actorid: actor,
      type: 'engine-assigned',
      entitytype: 'day',
      entityid: todayKey,
      title: 'Tasks for today',
      message: `${count} task${count === 1 ? '' : 's'} are on your day.`,
      link: '/my-day',
      idempotencykey: `schedule|${userid}|${todayKey}`,
    })
  }
}

export async function unlockDependents(taskId: string, actorUserId: string) {
  if (!(await engineEnabled())) return { unlocked: 0 }
  const done = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, templateid: true, clientId: true, projectid: true, periodkey: true, dueDate: true, status: true },
  })
  if (!done?.templateid || done.status !== 'Done') return { unlocked: 0 }
  const dependents = await prisma.templatedependency.findMany({
    where: { dependsonid: done.templateid },
    select: { templateid: true },
  })
  const templateIds = [...new Set(dependents.map((row) => row.templateid))]
  if (!templateIds.length) return { unlocked: 0 }
  const candidates = await prisma.task.findMany({
    where: {
      templateid: { in: templateIds },
      status: { in: ['Locked', 'WaitingOnInput'] },
    },
    include: {
      worktemplate: { include: { dependencies: true } },
    },
  })
  let unlocked = 0
  for (const candidate of candidates) {
    if (!candidate.templateid || !candidate.worktemplate) continue
    const pool = await instancesFor(
      candidate.worktemplate.dependencies.map((dep) => dep.dependsonid),
      candidate
    )
    const next = initialStatus({
      istimelock: candidate.worktemplate.istimelock,
      triggertype: candidate.worktemplate.triggertype,
      sameTeam: candidate.worktemplate.dependencies
        .filter((dep) => dep.kind === 'same-team')
        .map(asLink),
      crossTeam: candidate.worktemplate.dependencies
        .filter((dep) => dep.kind === 'cross-team')
        .map(asLink),
      pool,
      task: {
        clientid: candidate.clientId,
        projectid: candidate.projectid,
        periodkey: candidate.periodkey || '',
        dueat: candidate.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
      },
    })
    if (next.status !== 'ToDo') continue
    await prisma.task.update({
      where: { id: candidate.id },
      data: { status: 'ToDo', noinputflag: false },
    })
    await logActivity(actorUserId, 'STATUS', 'Task', candidate.id, undefined, {
      oldvalue: candidate.status,
      newvalue: 'ToDo',
    })
    if (candidate.assignedToId) {
      await createNotification(prisma, {
        recipientid: candidate.assignedToId,
        actorid: actorUserId,
        type: 'engine-unlock',
        entitytype: 'task',
        entityid: candidate.id,
        title: 'Task unlocked',
        message: candidate.title,
        link: `/tasks/${candidate.id}`,
        idempotencykey: `unlock|${candidate.id}|ToDo`,
      })
    }
    unlocked += 1
  }
  return { unlocked }
}

function asLink(dep: { dependsonid: string; kind: string; mode: string }): DepLink {
  return { dependsonid: dep.dependsonid, kind: dep.kind, mode: dep.mode === 'any' ? 'any' : 'all' }
}

async function instancesFor(
  templateIds: string[],
  task: { clientId: string | null; projectid: string | null; periodkey: string | null }
) {
  if (!templateIds.length) return []
  const rows = await prisma.task.findMany({
    where: {
      templateid: { in: templateIds },
      OR: [
        task.projectid ? { projectid: task.projectid } : { id: '__none__' },
        task.clientId ? { clientId: task.clientId } : { id: '__none__' },
        { periodkey: task.periodkey || '' },
      ],
    },
    select: { templateid: true, status: true, dueDate: true, clientId: true, projectid: true, periodkey: true },
  })
  return rows.map((row) => ({
    templateid: row.templateid as string,
    status: row.status,
    dueat: row.dueDate?.getTime() ?? 0,
    clientid: row.clientId,
    projectid: row.projectid,
    periodkey: row.periodkey || '',
  }))
}

export async function runReminders(now = new Date()) {
  if (!(await engineEnabled())) return { created: 0, skipped: 0, errors: 'engine disabled' }
  const todayKey = getISTDateKey(now)
  const waiting = await prisma.task.findMany({
    where: { status: 'WaitingOnInput', templateid: { not: null } },
    select: {
      id: true,
      title: true,
      waitingonuserid: true,
      worktemplate: { select: { dependencies: { where: { kind: 'cross-team' }, select: { dependsonid: true } } } },
    },
  })
  const providerTemplates = [...new Set(waiting.flatMap((task) => task.worktemplate?.dependencies.map((dep) => dep.dependsonid) ?? []))]
  const providers = await prisma.worktemplateassignee.findMany({
    where: { templateid: { in: providerTemplates } },
    select: { templateid: true, userid: true },
  })
  const counts = new Map<string, number>()
  for (const task of waiting) {
    const users = new Set<string>()
    if (task.waitingonuserid) users.add(task.waitingonuserid)
    for (const dep of task.worktemplate?.dependencies ?? []) {
      for (const provider of providers) {
        if (provider.templateid === dep.dependsonid) users.add(provider.userid)
      }
    }
    for (const userid of users) counts.set(userid, (counts.get(userid) ?? 0) + 1)
  }
  const actor = await actorId()
  let created = 0
  for (const [userid, count] of counts) {
    const wrote = await createNotification(prisma, {
      recipientid: userid,
      actorid: actor,
      type: 'engine-reminder',
      entitytype: 'day',
      entityid: todayKey,
      title: 'Waiting on your input',
      message: `${count} task${count === 1 ? '' : 's'} still need your input.`,
      link: '/waiting',
      idempotencykey: `remind|${userid}|${todayKey}`,
    })
    if (wrote) created += 1
  }
  await prisma.enginerun.create({
    data: { id: randomUUID(), kind: 'remind', created, skipped: waiting.length - created, errors: null },
  })
  return { created, skipped: waiting.length, errors: '' }
}

export async function runEscalation(now = new Date()) {
  if (!(await engineEnabled())) return { created: 0, skipped: 0, errors: 'engine disabled' }
  const holidays = await holidaySet()
  const tasks = await prisma.task.findMany({
    where: {
      templateid: { not: null },
      dueDate: { lt: now },
      status: { in: OPEN },
      worktemplate: { istimelock: false },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      assignedToId: true,
      worktemplate: { select: { istimelock: true } },
      User_Task_assignedToIdToUser: { select: { escalatestouserid: true } },
    },
  })
  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { id: true },
  })
  const actor = admins[0]?.id || (await actorId())
  let created = 0
  for (const task of tasks) {
    if (!task.dueDate) continue
    const target = escalationTarget({
      dueAtMs: task.dueDate.getTime(),
      nowMs: now.getTime(),
      priority: task.priority,
      istimelock: !!task.worktemplate?.istimelock,
      status: task.status,
      holidays,
    })
    if (target === 'none') continue
    const contact = task.User_Task_assignedToIdToUser?.escalatestouserid
    const recipients = target === 'admins' || !contact ? admins.map((admin) => admin.id) : [contact]
    for (const recipientid of recipients) {
      const wrote = await createNotification(prisma, {
        recipientid,
        actorid: actor,
        type: 'engine-escalation',
        entitytype: 'task',
        entityid: task.id,
        title: target === 'admins' ? 'Escalated to admins' : 'Escalated task',
        message: task.title,
        link: `/tasks/${task.id}`,
        priority: 'high',
        idempotencykey: `escalate|${task.id}|${target}|${recipientid}`,
      })
      if (wrote) created += 1
    }
  }
  await prisma.enginerun.create({
    data: { id: randomUUID(), kind: 'escalate', created, skipped: tasks.length, errors: null },
  })
  return { created, skipped: tasks.length, errors: '' }
}

export async function waitingAge(dueAt: Date | null, now = new Date()) {
  if (!dueAt) return 0
  const holidays = await holidaySet()
  return workingDaysAfter(istDateKey(dueAt.getTime()), getISTDateKey(now), holidays)
}
