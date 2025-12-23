'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'
import { canClockInOut } from '@/lib/rbac'
import { UserRole, AttendanceStatus, AttendanceMode } from '@prisma/client'

export async function clockIn(mode: AttendanceMode | string = AttendanceMode.OFFICE) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canClockInOut(session.user.role as UserRole)) {
    throw new Error('Only employees can clock in/out')
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  // Check if already clocked in today
  const existing = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
  })

  if (existing && existing.loginTime) {
    throw new Error('Already clocked in today')
  }

  // Cast mode to AttendanceMode enum
  const attendanceMode = mode as AttendanceMode

  let status: AttendanceStatus = AttendanceStatus.Present

  // Determine status based on mode
  if (attendanceMode === AttendanceMode.OFFICE) {
    // OFFICE MODE: loginTime <= 10:00 AM → Present, > 10:00 AM → Late
    const lateThreshold = new Date(today)
    lateThreshold.setHours(10, 0, 0, 0)
    status = now > lateThreshold ? AttendanceStatus.Late : AttendanceStatus.Present
  } else if (attendanceMode === AttendanceMode.WFH) {
    // WFH MODE: Status will be determined on clock out based on totalHours
    // For now, set as Present (will be updated on clock out)
    status = AttendanceStatus.Present
  } else if (attendanceMode === AttendanceMode.LEAVE) {
    // LEAVE MODE: Always Present (excluded from late/absent counts)
    status = AttendanceStatus.Present
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
    update: {
      loginTime: now,
      status,
      mode: attendanceMode,
    },
    create: {
      userId: session.user.id,
      date: today,
      loginTime: now,
      status,
      mode: attendanceMode,
    },
  })

  await logActivity(session.user.id, 'CREATE', 'Attendance', attendance.id)

  return attendance
}

export async function clockOut() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canClockInOut(session.user.role as UserRole)) {
    throw new Error('Only employees can clock in/out')
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const attendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
  })

  if (!attendance || !attendance.loginTime) {
    throw new Error('Please clock in first')
  }

  if (attendance.logoutTime) {
    throw new Error('Already clocked out today')
  }

  // Calculate total hours
  const totalHours = (now.getTime() - attendance.loginTime.getTime()) / (1000 * 60 * 60)

  // Update status based on mode and total hours
  let status = attendance.status

  if (attendance.mode === AttendanceMode.WFH) {
    // WFH MODE: If totalHours >= 8.5 → Present, else → Absent
    status = totalHours >= 8.5 ? AttendanceStatus.Present : AttendanceStatus.Absent
  }
  // For OFFICE mode, status was already set on clock in (Present or Late)
  // For LEAVE mode, status remains Present

  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      logoutTime: now,
      totalHours,
      status,
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'Attendance', updated.id)

  return updated
}

