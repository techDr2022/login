export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isCronRequestAuthorized } from '@/lib/cron-auth'

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
const TASK_TITLE = 'give review responses by EOD'

function getIstDateParts(now: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const byType = new Map(parts.map(part => [part.type, part.value]))

  return {
    weekday: byType.get('weekday') || '',
    year: Number(byType.get('year')),
    month: Number(byType.get('month')),
    day: Number(byType.get('day')),
    hour: Number(byType.get('hour')),
    minute: Number(byType.get('minute')),
  }
}

function getIstDayBoundsUtc(year: number, month: number, day: number) {
  const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { startUtc, endUtc }
}

function getIstTimeAsUtcDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - IST_OFFSET_MS)
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const istNow = getIstDateParts(now)

    // Safety window to avoid accidental execution at incorrect times.
    if (istNow.weekday !== 'Fri' || istNow.hour !== 12 || istNow.minute < 0 || istNow.minute > 15) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Skipped - current IST time is ${istNow.weekday} ${String(istNow.hour).padStart(2, '0')}:${String(istNow.minute).padStart(2, '0')}, expected Friday 12:00 PM`,
      })
    }

    const [gowthami, ayesha, venkat] = await Promise.all([
      prisma.user.findFirst({
        where: {
          isActive: true,
          OR: [
            { name: { contains: 'Gowthami', mode: 'insensitive' } },
            { name: { contains: 'Gouthami', mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true },
      }),
      prisma.user.findFirst({
        where: { isActive: true, name: { contains: 'Ayesha', mode: 'insensitive' } },
        select: { id: true, name: true },
      }),
      prisma.user.findFirst({
        where: { isActive: true, name: { contains: 'Venkat', mode: 'insensitive' } },
        select: { id: true, name: true },
      }),
    ])

    const assignees = [gowthami, ayesha, venkat].filter(Boolean) as Array<{ id: string; name: string }>
    const missingAssignees = [
      ...(gowthami ? [] : ['Gowthami']),
      ...(ayesha ? [] : ['Ayesha']),
      ...(venkat ? [] : ['Venkat']),
    ]

    if (assignees.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No target assignees found. Expected: Gowthami, Ayesha, Venkat',
          missingAssignees,
        },
        { status: 400 }
      )
    }

    const assignedBy =
      (await prisma.user.findFirst({
        where: {
          isActive: true,
          role: UserRole.SUPER_ADMIN,
          OR: [
            { name: { contains: 'Raviteja', mode: 'insensitive' } },
            { name: { contains: 'Ravi Teja', mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true },
      })) ||
      (await prisma.user.findFirst({
        where: { isActive: true, role: UserRole.SUPER_ADMIN },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      })) ||
      (await prisma.user.findFirst({
        where: { isActive: true, role: UserRole.MANAGER },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      }))

    if (!assignedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active SUPER_ADMIN or MANAGER found to assign tasks',
        },
        { status: 400 }
      )
    }

    const { startUtc, endUtc } = getIstDayBoundsUtc(istNow.year, istNow.month, istNow.day)
    const dueDateUtc = getIstTimeAsUtcDate(istNow.year, istNow.month, istNow.day, 18, 0)

    const existingTasks = await prisma.task.findMany({
      where: {
        title: TASK_TITLE,
        assignedToId: { in: assignees.map(user => user.id) },
        createdAt: {
          gte: startUtc,
          lte: endUtc,
        },
      },
      select: {
        id: true,
        assignedToId: true,
      },
    })

    const existingByAssignee = new Set(existingTasks.map(task => task.assignedToId).filter(Boolean))
    const usersToCreateFor = assignees.filter(user => !existingByAssignee.has(user.id))

    const createdTasks = await Promise.all(
      usersToCreateFor.map(user =>
        prisma.task.create({
          data: {
            id: randomUUID(),
            title: TASK_TITLE,
            description: 'Weekly review follow-up task. Share review responses by end of day.',
            priority: 'High',
            status: 'Pending',
            assignedById: assignedBy.id,
            assignedToId: user.id,
            startDate: now,
            dueDate: dueDateUtc,
          },
          select: {
            id: true,
            title: true,
            assignedToId: true,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      message: `Weekly review response tasks processed for ${assignees.length} assignee(s)`,
      assignedBy: assignedBy.name,
      createdCount: createdTasks.length,
      skippedExistingCount: assignees.length - createdTasks.length,
      assigneesFound: assignees.map(user => user.name),
      missingAssignees: missingAssignees.length > 0 ? missingAssignees : undefined,
      createdTaskIds: createdTasks.map(task => task.id),
    })
  } catch (error: any) {
    console.error('[Weekly Review Response Tasks] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}
