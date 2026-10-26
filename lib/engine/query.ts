import { prisma } from '@/lib/prisma'
import { dateAtISTWallClock, getISTDateKey } from '@/lib/attendance-config'
import { workingDaysAfter, istDateKey } from '@/lib/engine/rules'

const CLOSED = ['Done', 'Cancelled', 'Approved', 'Rejected'] as const

const taskSelect = {
  id: true,
  title: true,
  status: true,
  dueDate: true,
  startDate: true,
  priority: true,
  templateid: true,
  noinputflag: true,
  revisioncount: true,
  clientId: true,
  periodkey: true,
  projectid: true,
  assignedToId: true,
  Client: { select: { id: true, name: true } },
  worktemplate: {
    select: {
      id: true,
      istimelock: true,
      donewhen: true,
      needsconfirmation: true,
      section: true,
      team: { select: { name: true } },
    },
  },
} as const

export async function myEngineTasks(userId: string) {
  const links = await prisma.worktemplateassignee.findMany({
    where: { userid: userId },
    select: { templateid: true },
  })
  return prisma.task.findMany({
    where: {
      templateid: { not: null },
      status: { notIn: [...CLOSED] },
      OR: [
        { assignedToId: userId },
        { assignedToId: null, templateid: { in: links.map((link) => link.templateid) } },
      ],
    },
    select: taskSelect,
    orderBy: [{ dueDate: 'asc' }],
    take: 300,
  })
}

const ROW_CAP = 1200

export type DayBucket = 'today' | 'overdue' | 'upcoming' | 'undated'

export type DayTask = {
  id: string
  title: string
  status: string
  dueDate: string | null
  priority: string
  noinputflag: boolean
  clientName: string | null
  team: string | null
  section: string | null
  istimelock: boolean
  bucket: DayBucket
}

export type DayList = {
  tasks: DayTask[]
  truncated: boolean
}

type DaySqlRow = {
  id: string
  title: string
  status: string
  dueDate: Date | null
  priority: string
  noinputflag: boolean
  clientName: string | null
  istimelock: boolean | null
  section: string | null
  team: string | null
}

export async function myDayTasks(userId: string): Promise<DayList> {
  const todayKey = getISTDateKey(new Date())
  const rows = await prisma.$queryRaw<DaySqlRow[]>`
    SELECT
      t.id,
      t.title,
      t.status::text AS status,
      t."dueDate",
      t.priority::text AS priority,
      t.noinputflag,
      c.name AS "clientName",
      w.istimelock,
      w.section,
      tm.name AS team
    FROM "Task" t
    LEFT JOIN "Client" c ON c.id = t."clientId"
    LEFT JOIN "Worktemplate" w ON w.id = t.templateid
    LEFT JOIN "Team" tm ON tm.id = w.teamid
    WHERE t.templateid IS NOT NULL
      AND t.status::text NOT IN ('Done', 'Cancelled', 'Approved', 'Rejected')
      AND (
        t."assignedToId" = ${userId}
        OR (
          t."assignedToId" IS NULL
          AND t.templateid IN (
            SELECT a.templateid FROM "Worktemplateassignee" a WHERE a.userid = ${userId}
          )
        )
      )
    ORDER BY t."dueDate" ASC NULLS LAST
    LIMIT 1200
  `
  const tasks: DayTask[] = []
  const undated: DayTask[] = []
  for (const row of rows) {
    const istimelock = !!row.istimelock
    let bucket: DayBucket
    if (!row.dueDate) bucket = 'undated'
    else {
      const key = getISTDateKey(row.dueDate)
      if (key === todayKey) bucket = 'today'
      else if (key > todayKey) bucket = 'upcoming'
      else if (istimelock) continue
      else bucket = 'overdue'
    }
    const task: DayTask = {
      id: row.id,
      title: row.title,
      status: row.status,
      dueDate: row.dueDate ? row.dueDate.toISOString() : null,
      priority: row.priority,
      noinputflag: row.noinputflag,
      clientName: row.clientName,
      team: row.team,
      section: row.section,
      istimelock,
      bucket,
    }
    if (bucket === 'undated') undated.push(task)
    else tasks.push(task)
  }
  undated.sort((left, right) => left.title.localeCompare(right.title))
  return { tasks: [...tasks, ...undated], truncated: rows.length === ROW_CAP }
}

function sameWork(
  left: { clientId: string | null; projectid: string | null; periodkey: string | null },
  right: { clientId: string | null; projectid: string | null; periodkey: string | null }
) {
  if (left.projectid && right.projectid) return left.projectid === right.projectid || left.clientId === right.clientId
  if (left.clientId || right.clientId) return left.clientId === right.clientId
  return left.periodkey === right.periodkey
}

export async function waitingOnMe(userId: string) {
  const mine = await myEngineTasks(userId)
  const templateIds = [...new Set(mine.map((task) => task.templateid).filter((id): id is string => !!id))]
  if (!templateIds.length) return []
  const blocked = await prisma.task.findMany({
    where: {
      status: { in: ['Locked', 'WaitingOnInput'] },
      worktemplate: { dependencies: { some: { dependsonid: { in: templateIds } } } },
    },
    select: {
      title: true,
      clientId: true,
      projectid: true,
      periodkey: true,
      User_Task_assignedToIdToUser: { select: { name: true } },
      worktemplate: { select: { dependencies: { select: { dependsonid: true } } } },
    },
  })
  return mine
    .map((task) => {
      const waiters = blocked.filter(
        (item) =>
          item.worktemplate?.dependencies.some((dep) => dep.dependsonid === task.templateid) && sameWork(task, item)
      )
      return { task, waiters }
    })
    .filter((row) => row.waiters.length > 0)
}

export async function imWaitingOn(userId: string) {
  const tasks = await prisma.task.findMany({
    where: {
      templateid: { not: null },
      status: { in: ['Locked', 'WaitingOnInput'] },
      OR: [{ assignedToId: userId }, { assignedToId: null, worktemplate: { assignees: { some: { userid: userId } } } }],
    },
    select: {
      ...taskSelect,
      waitingon: { select: { name: true } },
      worktemplate: {
        select: {
          ...taskSelect.worktemplate.select,
          dependencies: { select: { dependsonid: true, dependson: { select: { title: true } } } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 100,
  })
  return tasks
}

export async function adminEngineOverview() {
  const now = new Date()
  const holidays = new Set(
    (await prisma.attendance_holidays.findMany({ select: { date: true } })).map((row) => row.date.toISOString().slice(0, 10))
  )
  const [overdue, blocked, unconfirmed, lastRun, enabled] = await Promise.all([
    prisma.task.findMany({
      where: {
        templateid: { not: null },
        dueDate: { lt: now },
        status: { notIn: [...CLOSED] },
        worktemplate: { istimelock: false },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        User_Task_assignedToIdToUser: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 40,
    }),
    prisma.task.findMany({
      where: { templateid: { not: null }, status: { in: ['Locked', 'WaitingOnInput'] } },
      select: { id: true, title: true, status: true, dueDate: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 40,
    }),
    prisma.worktemplate.count({ where: { active: true, needsconfirmation: true } }),
    prisma.enginerun.findFirst({ orderBy: { createdat: 'desc' } }),
    prisma.appsetting.findUnique({ where: { id: 'NEW_ENGINE_ENABLED' } }),
  ])
  const stale = blocked.filter((task) => workingDaysAfter(istDateKey(task.createdAt.getTime()), getISTDateKey(now), holidays) > 3)
  return { overdue, blocked, stale, unconfirmed, lastRun, enabled: enabled?.value === 'true' }
}

export async function taskEngineDetail(taskId: string, templateid: string | null) {
  const history = await prisma.activity_logs.findMany({
    where: { entityType: 'Task', entityId: taskId },
    orderBy: { timestamp: 'desc' },
    take: 40,
    include: { User: { select: { name: true } } },
  })
  if (!templateid) return { history, dependencies: [] }
  const dependencies = await prisma.templatedependency.findMany({
    where: { OR: [{ templateid }, { dependsonid: templateid }] },
    select: {
      templateid: true,
      dependsonid: true,
      kind: true,
      mode: true,
      template: { select: { title: true } },
      dependson: { select: { title: true } },
    },
  })
  return { history, dependencies }
}

export async function publicBoardTasks() {
  const today = getISTDateKey(new Date())
  const start = dateAtISTWallClock(today, 0, 0)
  const [year, month, day] = today.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1, -5, -30, 0))
  const tasks = await prisma.task.findMany({
    where: {
      templateid: { not: null },
      dueDate: { gte: start, lt: next },
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      assignedToId: true,
      Client: { select: { name: true } },
      User_Task_assignedToIdToUser: { select: { id: true, name: true, team: { select: { name: true } } } },
      worktemplate: { select: { istimelock: true, team: { select: { name: true } } } },
    },
    orderBy: { dueDate: 'asc' },
    take: 2000,
  })
  return tasks
}
