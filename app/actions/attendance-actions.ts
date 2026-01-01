'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'
import { canClockInOut } from '@/lib/rbac'
import { UserRole, AttendanceStatus, AttendanceMode } from '@prisma/client'
import { randomUUID } from 'crypto'
import { 
  ATTENDANCE_CONFIG, 
  getOfficeStartTime, 
  isLate as checkIsLate 
} from '@/lib/attendance-config'

export async function clockIn(mode: AttendanceMode | string = AttendanceMode.OFFICE) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!session.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  if (!canClockInOut(session.user.role as UserRole)) {
    throw new Error('Only employees can clock in/out')
  }

  // Verify user exists in database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true },
  })

  if (!user) {
    throw new Error('User not found in database. Please log in again.')
  }

  if (!user.isActive) {
    throw new Error('Your account is inactive. Please contact an administrator.')
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  // Check if already clocked in today
  const existing = await prisma.attendances.findUnique({
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
  let earlySignInMinutes: number | null = null
  let lateSignInMinutes: number | null = null

  // Expected login time: 10:00 AM
  const expectedLoginTime = getOfficeStartTime(today)

  // Calculate early/late sign in minutes
  if (attendanceMode === AttendanceMode.OFFICE) {
    const diffMinutes = Math.round((now.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
    
    if (diffMinutes < 0) {
      // Signed in early
      earlySignInMinutes = Math.abs(diffMinutes)
      lateSignInMinutes = 0
      status = AttendanceStatus.Present
    } else if (checkIsLate(now, expectedLoginTime)) {
      // Signed in late (after 10:05 AM)
      earlySignInMinutes = 0
      lateSignInMinutes = diffMinutes
      status = AttendanceStatus.Late
    } else {
      // Exactly on time (within 5 minutes)
      earlySignInMinutes = 0
      lateSignInMinutes = 0
      status = AttendanceStatus.Present
    }
  } else if (attendanceMode === AttendanceMode.WFH) {
    // WFH MODE: Status will be determined on clock out based on totalHours
    // For now, set as Present (will be updated on clock out)
    status = AttendanceStatus.Present
    earlySignInMinutes = null
    lateSignInMinutes = null
    // Initialize WFH activity tracking
  } else if (attendanceMode === AttendanceMode.LEAVE) {
    // LEAVE MODE: Always Present (excluded from late/absent counts)
    status = AttendanceStatus.Present
    earlySignInMinutes = null
    lateSignInMinutes = null
  }

  const attendance = await prisma.attendances.upsert({
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
      earlySignInMinutes,
      lateSignInMinutes,
      lastActivityTime: attendanceMode === AttendanceMode.WFH ? now : null,
      wfhActivityPings: attendanceMode === AttendanceMode.WFH ? 1 : 0,
    },
    create: {
      id: randomUUID(),
      userId: session.user.id,
      date: today,
      loginTime: now,
      status,
      mode: attendanceMode,
      earlySignInMinutes,
      lateSignInMinutes,
      lastActivityTime: attendanceMode === AttendanceMode.WFH ? now : null,
      wfhActivityPings: attendanceMode === AttendanceMode.WFH ? 1 : 0,
    },
  })

  await logActivity(session.user.id, 'CREATE', 'Attendance', attendance.id)

  // Return serializable object (convert Date objects to ISO strings)
  return {
    id: attendance.id,
    userId: attendance.userId,
    date: attendance.date.toISOString(),
    loginTime: attendance.loginTime?.toISOString() ?? null,
    logoutTime: attendance.logoutTime?.toISOString() ?? null,
    status: attendance.status,
    mode: attendance.mode,
    earlySignInMinutes: attendance.earlySignInMinutes,
    lateSignInMinutes: attendance.lateSignInMinutes,
    earlyLogoutMinutes: attendance.earlyLogoutMinutes,
    lateLogoutMinutes: attendance.lateLogoutMinutes,
    totalHours: attendance.totalHours,
    lastActivityTime: attendance.lastActivityTime?.toISOString() ?? null,
    wfhActivityPings: attendance.wfhActivityPings,
  }
}

export async function clockOut() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!session.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  if (!canClockInOut(session.user.role as UserRole)) {
    throw new Error('Only employees can clock in/out')
  }

  // Verify user exists in database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true },
  })

  if (!user) {
    throw new Error('User not found in database. Please log in again.')
  }

  if (!user.isActive) {
    throw new Error('Your account is inactive. Please contact an administrator.')
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const attendance = await prisma.attendances.findUnique({
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

  // Expected logout time: 7:00 PM
  const expectedLogoutTime = new Date(today)
  expectedLogoutTime.setHours(ATTENDANCE_CONFIG.OFFICE_END_HOUR, ATTENDANCE_CONFIG.OFFICE_END_MINUTE, 0, 0)

  // Calculate early/late logout minutes
  let earlyLogoutMinutes: number | null = null
  let lateLogoutMinutes: number | null = null

  if (attendance.mode === AttendanceMode.OFFICE) {
    const diffMinutes = Math.round((now.getTime() - expectedLogoutTime.getTime()) / (1000 * 60))
    
    if (diffMinutes < 0) {
      // Logged out early
      earlyLogoutMinutes = Math.abs(diffMinutes)
      lateLogoutMinutes = 0
    } else if (diffMinutes > 0) {
      // Logged out late
      earlyLogoutMinutes = 0
      lateLogoutMinutes = diffMinutes
    } else {
      // Exactly on time
      earlyLogoutMinutes = 0
      lateLogoutMinutes = 0
    }
  }

  // Calculate total hours (excluding lunch break: 1:00 PM to 1:30 PM = 30 minutes)
  let totalHours = (now.getTime() - attendance.loginTime.getTime()) / (1000 * 60 * 60)
  
  // Subtract lunch break if both login and logout times are within the same day
  if (attendance.mode === AttendanceMode.OFFICE) {
    const lunchBreakHours = ATTENDANCE_CONFIG.LUNCH_DURATION_MINUTES / 60 // 30 minutes = 0.5 hours
    totalHours = totalHours - lunchBreakHours
  }

  // Update status based on mode and total hours
  let status = attendance.status

  if (attendance.mode === AttendanceMode.WFH) {
    // WFH MODE: If totalHours >= 8.5 → Present, else → Absent
    status = totalHours >= ATTENDANCE_CONFIG.WFH_MIN_HOURS_FOR_PRESENT ? AttendanceStatus.Present : AttendanceStatus.Absent
    earlyLogoutMinutes = null
    lateLogoutMinutes = null
  }
  // For OFFICE mode, status was already set on clock in (Present or Late)
  // For LEAVE mode, status remains Present

  const updated = await prisma.attendances.update({
    where: { id: attendance.id },
    data: {
      logoutTime: now,
      totalHours,
      status,
      earlyLogoutMinutes,
      lateLogoutMinutes,
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'Attendance', updated.id)

  // Return serializable object (convert Date objects to ISO strings)
  return {
    id: updated.id,
    userId: updated.userId,
    date: updated.date.toISOString(),
    loginTime: updated.loginTime?.toISOString() ?? null,
    logoutTime: updated.logoutTime?.toISOString() ?? null,
    status: updated.status,
    mode: updated.mode,
    earlySignInMinutes: updated.earlySignInMinutes,
    lateSignInMinutes: updated.lateSignInMinutes,
    earlyLogoutMinutes: updated.earlyLogoutMinutes,
    lateLogoutMinutes: updated.lateLogoutMinutes,
    totalHours: updated.totalHours,
    lastActivityTime: updated.lastActivityTime?.toISOString() ?? null,
    wfhActivityPings: updated.wfhActivityPings,
  }
}

export async function startLunchBreak() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!session.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  if (!canClockInOut(session.user.role as UserRole)) {
    throw new Error('Only employees can manage lunch breaks')
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const attendance = await prisma.attendances.findUnique({
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

  if (attendance.lunchStart) {
    throw new Error('Lunch break already started')
  }

  const updated = await prisma.attendances.update({
    where: { id: attendance.id },
    data: {
      lunchStart: now,
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'Attendance', updated.id)

  return updated
}

export async function endLunchBreak() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!session.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  if (!canClockInOut(session.user.role as UserRole)) {
    throw new Error('Only employees can manage lunch breaks')
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const attendance = await prisma.attendances.findUnique({
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

  if (!attendance.lunchStart) {
    throw new Error('Lunch break not started')
  }

  if (attendance.lunchEnd) {
    throw new Error('Lunch break already ended')
  }

  const updated = await prisma.attendances.update({
    where: { id: attendance.id },
    data: {
      lunchEnd: now,
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'Attendance', updated.id)

  return updated
}

export async function pingWFHActivity() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!session.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  if (!canClockInOut(session.user.role as UserRole)) {
    throw new Error('Only employees can ping WFH activity')
  }

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const attendance = await prisma.attendances.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
  })

  if (!attendance || attendance.mode !== AttendanceMode.WFH || !attendance.loginTime) {
    throw new Error('WFH attendance not found or not in WFH mode')
  }

  if (attendance.logoutTime) {
    throw new Error('Already clocked out')
  }

  const updated = await prisma.attendances.update({
    where: { id: attendance.id },
    data: {
      lastActivityTime: now,
      wfhActivityPings: {
        increment: 1,
      },
    },
  })

  return updated
}

export async function markAllAttendanceForDay(date: Date, mode: AttendanceMode = AttendanceMode.OFFICE) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!session.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admin can mark all attendance')
  }

  // Set the date to start of day
  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  // Get all active employees
  const employees = await prisma.user.findMany({
    where: {
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  if (employees.length === 0) {
    throw new Error('No active employees found')
  }

  // Get office start and end times for the target date
  const officeStartTime = getOfficeStartTime(targetDate)
  const officeEndTime = new Date(targetDate)
  officeEndTime.setHours(ATTENDANCE_CONFIG.OFFICE_END_HOUR, ATTENDANCE_CONFIG.OFFICE_END_MINUTE, 0, 0)

  // Calculate total hours (excluding lunch break)
  const totalHours = (officeEndTime.getTime() - officeStartTime.getTime()) / (1000 * 60 * 60) - (ATTENDANCE_CONFIG.LUNCH_DURATION_MINUTES / 60)

  const results = []
  const errors = []

  // Mark attendance for each employee
  for (const employee of employees) {
    try {
      // Check if attendance already exists
      const existing = await prisma.attendances.findUnique({
        where: {
          userId_date: {
            userId: employee.id,
            date: targetDate,
          },
        },
      })

      const attendanceData = {
        loginTime: officeStartTime,
        logoutTime: officeEndTime,
        status: AttendanceStatus.Present,
        mode: mode,
        earlySignInMinutes: 0,
        lateSignInMinutes: 0,
        earlyLogoutMinutes: 0,
        lateLogoutMinutes: 0,
        totalHours: mode === AttendanceMode.OFFICE ? totalHours : null,
        editedBy: session.user.id,
        editedAt: new Date(),
      }

      let attendanceId: string
      if (existing) {
        // Update existing attendance
        const updated = await prisma.attendances.update({
          where: { id: existing.id },
          data: attendanceData,
        })
        attendanceId = updated.id
        results.push({ userId: employee.id, action: 'updated', attendanceId: updated.id })
      } else {
        // Create new attendance
        const created = await prisma.attendances.create({
          data: {
            id: randomUUID(),
            userId: employee.id,
            date: targetDate,
            ...attendanceData,
          },
        })
        attendanceId = created.id
        results.push({ userId: employee.id, action: 'created', attendanceId: created.id })
      }

      // Log activity
      await logActivity(session.user.id, existing ? 'UPDATE' : 'CREATE', 'Attendance', attendanceId)
    } catch (error) {
      errors.push({ userId: employee.id, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  return {
    success: true,
    totalEmployees: employees.length,
    processed: results.length,
    errorCount: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
  }
}

