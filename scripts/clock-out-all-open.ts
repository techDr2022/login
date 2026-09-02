/**
 * Clock out all employees with open attendance sessions for today (IST).
 *
 * Usage:
 *   npx tsx scripts/clock-out-all-open.ts
 */

import { PrismaClient, AttendanceMode, AttendanceStatus, UserRole } from '@prisma/client'
import { logActivity } from '../lib/activity-log'
import {
  ATTENDANCE_CONFIG,
  getISTDateKey,
  getOfficeEndTime,
  getLunchStartTime,
} from '../lib/attendance-config'

const prisma = new PrismaClient()

function attendanceDateFromIST(date: Date): Date {
  const dateKey = getISTDateKey(date)
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function computeClockOutFields(
  mode: AttendanceMode,
  dayStart: Date,
  loginTime: Date,
  logoutTime: Date,
  currentStatus: AttendanceStatus
) {
  let totalHours = (logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)
  let earlyLogoutMinutes: number | null = null
  let lateLogoutMinutes: number | null = null
  let status = currentStatus

  if (mode === AttendanceMode.OFFICE) {
    const expectedLogoutTime = getOfficeEndTime(dayStart)
    const diffMinutes = Math.round(
      (logoutTime.getTime() - expectedLogoutTime.getTime()) / (1000 * 60)
    )

    if (diffMinutes < 0) {
      earlyLogoutMinutes = Math.abs(diffMinutes)
      lateLogoutMinutes = 0
    } else if (diffMinutes > 0) {
      earlyLogoutMinutes = 0
      lateLogoutMinutes = diffMinutes
    } else {
      earlyLogoutMinutes = 0
      lateLogoutMinutes = 0
    }

    const lunchStartTime = getLunchStartTime(dayStart)
    if (logoutTime >= lunchStartTime) {
      totalHours -= ATTENDANCE_CONFIG.LUNCH_DURATION_MINUTES / 60
    }
    if (totalHours < 0) totalHours = 0
  } else if (mode === AttendanceMode.WFH) {
    status =
      totalHours >= ATTENDANCE_CONFIG.WFH_MIN_HOURS_FOR_PRESENT
        ? AttendanceStatus.Present
        : AttendanceStatus.Absent
    earlyLogoutMinutes = null
    lateLogoutMinutes = null
  }

  return { totalHours, status, earlyLogoutMinutes, lateLogoutMinutes }
}

async function clockOutAllOpen() {
  const now = new Date()
  const dateKey = getISTDateKey(now)
  const today = attendanceDateFromIST(now)

  console.log(`\nClocking out open sessions for ${dateKey} (IST)...`)

  const openSessions = await prisma.attendances.findMany({
    where: {
      date: today,
      loginTime: { not: null },
      logoutTime: null,
    },
    include: {
      User: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  })

  if (openSessions.length === 0) {
    console.log('No open attendance sessions found.')
    return
  }

  console.log(`Found ${openSessions.length} open session(s):`)
  for (const session of openSessions) {
    console.log(`  - ${session.User.name} (${session.User.email}) [${session.mode}]`)
  }

  const superAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN, isActive: true },
    select: { id: true },
  })

  let successCount = 0
  let errorCount = 0

  for (const attendance of openSessions) {
    if (!attendance.loginTime) continue

    try {
      const { totalHours, status, earlyLogoutMinutes, lateLogoutMinutes } =
        computeClockOutFields(
          attendance.mode,
          today,
          attendance.loginTime,
          now,
          attendance.status
        )

      await prisma.attendances.update({
        where: { id: attendance.id },
        data: {
          logoutTime: now,
          totalHours,
          status,
          earlyLogoutMinutes,
          lateLogoutMinutes,
        },
      })

      if (superAdmin) {
        await logActivity(superAdmin.id, 'UPDATE', 'Attendance', attendance.id)
      }

      console.log(
        `  Done: ${attendance.User.name} — ${totalHours?.toFixed(2) ?? 'N/A'} hrs (${status})`
      )
      successCount++
    } catch (error) {
      console.error(
        `  Failed: ${attendance.User.name} —`,
        error instanceof Error ? error.message : error
      )
      errorCount++
    }
  }

  console.log(`\nSummary: ${successCount} clocked out${errorCount > 0 ? `, ${errorCount} failed` : ''}.`)
}

clockOutAllOpen()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
