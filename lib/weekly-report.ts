import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { dateAtISTWallClock, getISTDateKey } from '@/lib/attendance-config'
import { previousIstWeek } from '@/lib/ist-week'
import { clientTaskLabel } from '@/lib/client-task-label'

export type WeekReportTask = {
  title: string
  label: string
  due: string | null
  deliverableurl: string | null
  timeSpent: number | null
}

export type WeekReportDay = {
  date: string
  tasks: WeekReportTask[]
}

export type WeekReportSnapshot = {
  clientName: string
  doctorOrHospitalName: string
  weekstart: string
  weekend: string
  timezone: 'Asia/Kolkata'
  openCount: number
  finishedCount: number
  tasks: WeekReportTask[]
  days: WeekReportDay[]
  postersDesigned: number | null
  postersApproved: number | null
  videosEdited: number | null
  videosPosted: number | null
}

function dateKey(value: Date | null | undefined) {
  if (!value) return null
  return getISTDateKey(value)
}

function inRange(key: string | null, fromKey: string, toKey: string) {
  return !!key && key >= fromKey && key <= toKey
}

export function reportRange(fromKey?: string, toKey?: string) {
  if (!fromKey && !toKey) {
    const week = previousIstWeek()
    return {
      fromKey: week.weekstartKey,
      toKey: week.weekendKey,
      weekstart: week.weekstart,
      weekend: week.weekend,
    }
  }
  if (!fromKey || !toKey || !/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) {
    throw new Error('Choose a start date and an end date')
  }
  if (toKey < fromKey) throw new Error('End date must be on or after the start date')
  const weekstart = new Date(`${fromKey}T00:00:00.000Z`)
  const weekend = new Date(`${toKey}T00:00:00.000Z`)
  const days = Math.round((weekend.getTime() - weekstart.getTime()) / 86400000) + 1
  if (days > 366) throw new Error('Choose a range of one year or less')
  return { fromKey, toKey, weekstart, weekend }
}

export async function buildWeeklyReport(clientId: string, fromKey?: string, toKey?: string) {
  const range = reportRange(fromKey, toKey)
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, doctorOrHospitalName: true },
  })
  if (!client) throw new Error('Client not found')

  const from = dateAtISTWallClock(range.fromKey, 0, 0, 0)
  const to = dateAtISTWallClock(range.toKey, 23, 59, 59)

  const tasks = await prisma.task.findMany({
    where: {
      clientId,
      status: { not: 'Rejected' },
      OR: [
        { createdAt: { gte: from, lte: to } },
        { dueDate: { gte: from, lte: to } },
        { startDate: { gte: from, lte: to } },
      ],
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      title: true,
      status: true,
      dueDate: true,
      deliverableurl: true,
      createdAt: true,
      startDate: true,
      timeSpent: true,
    },
  })

  const month = range.fromKey.slice(0, 7)
  const [posters, videos] = await Promise.all([
    prisma.monthlyProduction.findUnique({
      where: { clientId_monthKey: { clientId, monthKey: month } },
      select: { designedCount: true, approvedCount: true },
    }),
    prisma.clientVideoMonth.findUnique({
      where: { clientId_monthKey: { clientId, monthKey: month } },
      select: { editedCount: true, postedCount: true },
    }),
  ])

  const byDate = new Map<string, WeekReportTask[]>()
  for (const task of tasks) {
    const due = dateKey(task.dueDate)
    const created = dateKey(task.createdAt)
    const start = dateKey(task.startDate)
    const day = inRange(due, range.fromKey, range.toKey)
      ? due
      : inRange(created, range.fromKey, range.toKey)
        ? created
        : inRange(start, range.fromKey, range.toKey)
          ? start
          : null
    if (!day) continue
    const row: WeekReportTask = {
      title: task.title,
      label: clientTaskLabel(task.status, task.dueDate),
      due: due,
      deliverableurl: task.deliverableurl,
      timeSpent: task.timeSpent && task.timeSpent > 0 ? task.timeSpent : null,
    }
    const list = byDate.get(day) || []
    list.push(row)
    byDate.set(day, list)
  }

  const days: WeekReportDay[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({ date, tasks: rows }))
  const flat = days.flatMap((day) => day.tasks)

  const snapshot: WeekReportSnapshot = {
    clientName: client.name,
    doctorOrHospitalName: client.doctorOrHospitalName,
    weekstart: range.fromKey,
    weekend: range.toKey,
    timezone: 'Asia/Kolkata',
    openCount: flat.filter((row) => row.label !== 'Finished').length,
    finishedCount: flat.filter((row) => row.label === 'Finished').length,
    tasks: flat,
    days,
    postersDesigned: posters?.designedCount ?? null,
    postersApproved: posters?.approvedCount ?? null,
    videosEdited: videos?.editedCount ?? null,
    videosPosted: videos?.postedCount ?? null,
  }

  const where = {
    clientid: clientId,
    weekstart: range.weekstart,
    weekend: range.weekend,
  }
  const data = { snapshot, status: 'ready' }
  const existing = await prisma.clientweeklyreport.findFirst({ where, select: { id: true } })
  if (existing) {
    return prisma.clientweeklyreport.update({ where: { id: existing.id }, data })
  }
  try {
    return await prisma.clientweeklyreport.create({
      data: { ...where, timezone: 'Asia/Kolkata', ...data },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    const again = await prisma.clientweeklyreport.findFirst({ where, select: { id: true } })
    if (!again) throw error
    return prisma.clientweeklyreport.update({ where: { id: again.id }, data })
  }
}

export async function buildWeeklyReportsForActiveClients() {
  const clients = await prisma.client.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  })
  const results: Array<{ clientId: string; name: string; ok: boolean; error?: string }> = []
  for (const client of clients) {
    try {
      await buildWeeklyReport(client.id)
      results.push({ clientId: client.id, name: client.name, ok: true })
    } catch (error) {
      results.push({
        clientId: client.id,
        name: client.name,
        ok: false,
        error: error instanceof Error ? error.message : 'Failed',
      })
    }
  }
  return {
    created: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    results,
  }
}
