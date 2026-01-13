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
  isLate as checkIsLate,
  getHalfDayThresholdTime,
  getAbsentThresholdTime
} from '@/lib/attendance-config'
import { sendWhatsAppNotification, formatAttendanceNotificationMessage, getAttendanceNotificationTemplateVariables } from '@/lib/whatsapp'
import { revalidatePath } from 'next/cache'

export async function clockIn(mode: AttendanceMode | string = AttendanceMode.OFFICE) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!session.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  if (!canClockInOut(session.user.role as UserRole)) {
    throw new Error('Only employees can clock in/out')
  }

  // Verify user exists in database and get name
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true, name: true },
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

  // Check if already clocked in today (and not clocked out yet)
  const existing = await prisma.attendances.findUnique({
    where: {
      userId_date: {
        userId: session.user.id,
        date: today,
      },
    },
  })

  // Cast mode to AttendanceMode enum
  const attendanceMode = mode as AttendanceMode

  // If already clocked in and not clocked out, allow mode change instead of throwing error
  // This is useful for WFH period when employees might need to switch modes
  if (existing && existing.loginTime && !existing.logoutTime) {
    // If mode is the same, prevent duplicate clock in
    if (existing.mode === attendanceMode) {
      throw new Error('Already clocked in today with the same mode')
    }
    
    // Allow mode change - update existing attendance with new mode
    // Keep the original loginTime but update mode and related fields
    const originalLoginTime = existing.loginTime
    
    // For WFH mode, initialize activity tracking
    if (attendanceMode === AttendanceMode.WFH) {
      await prisma.attendances.update({
        where: { id: existing.id },
        data: {
          mode: attendanceMode,
          status: AttendanceStatus.Present,
          earlySignInMinutes: null,
          lateSignInMinutes: null,
          lastActivityTime: now,
          wfhActivityPings: 1,
        },
      })
      
      await logActivity(session.user.id, 'UPDATE', 'Attendance', existing.id)
      
      // Revalidate paths to refresh UI
      revalidatePath('/attendance')
      revalidatePath('/dashboard')
      
      return {
        id: existing.id,
        userId: existing.userId,
        date: existing.date.toISOString(),
        loginTime: originalLoginTime.toISOString(),
        logoutTime: null,
        status: AttendanceStatus.Present,
        mode: attendanceMode,
        earlySignInMinutes: null,
        lateSignInMinutes: null,
        earlyLogoutMinutes: null,
        lateLogoutMinutes: null,
        totalHours: null,
        lastActivityTime: now.toISOString(),
        wfhActivityPings: 1,
      }
    }
    
    // For OFFICE or LEAVE mode changes
    let status: AttendanceStatus = AttendanceStatus.Present
    let earlySignInMinutes: number | null = null
    let lateSignInMinutes: number | null = null
    
    if (attendanceMode === AttendanceMode.OFFICE) {
      const expectedLoginTime = getOfficeStartTime(today)
      const halfDayThreshold = getHalfDayThresholdTime(today)
      const absentThreshold = getAbsentThresholdTime(today)
      
      if (originalLoginTime >= absentThreshold) {
        earlySignInMinutes = 0
        lateSignInMinutes = Math.round((originalLoginTime.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
        status = AttendanceStatus.Absent
      } else if (originalLoginTime >= halfDayThreshold) {
        lateSignInMinutes = Math.round((originalLoginTime.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
        status = AttendanceStatus.HalfDay
      } else if (checkIsLate(originalLoginTime, expectedLoginTime)) {
        lateSignInMinutes = Math.round((originalLoginTime.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
        status = AttendanceStatus.Late
      } else {
        const diffMinutes = Math.round((originalLoginTime.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
        if (diffMinutes < 0) {
          earlySignInMinutes = Math.abs(diffMinutes)
          lateSignInMinutes = 0
        } else {
          earlySignInMinutes = 0
          lateSignInMinutes = 0
        }
        status = AttendanceStatus.Present
      }
    } else if (attendanceMode === AttendanceMode.LEAVE) {
      status = AttendanceStatus.Present
      earlySignInMinutes = null
      lateSignInMinutes = null
    }
    
    const updated = await prisma.attendances.update({
      where: { id: existing.id },
      data: {
        mode: attendanceMode,
        status,
        earlySignInMinutes,
        lateSignInMinutes,
        lastActivityTime: null, // Clear WFH tracking for non-WFH modes
        wfhActivityPings: 0, // Clear WFH pings for non-WFH modes
      },
    })
    
    await logActivity(session.user.id, 'UPDATE', 'Attendance', existing.id)
    
    // Revalidate paths to refresh UI
    revalidatePath('/attendance')
    revalidatePath('/dashboard')
    
    return {
      id: updated.id,
      userId: updated.userId,
      date: updated.date.toISOString(),
      loginTime: originalLoginTime.toISOString(),
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

  let status: AttendanceStatus = AttendanceStatus.Present
  let earlySignInMinutes: number | null = null
  let lateSignInMinutes: number | null = null

  // Expected login time: 10:00 AM
  const expectedLoginTime = getOfficeStartTime(today)

  // Calculate early/late sign in minutes
  if (attendanceMode === AttendanceMode.OFFICE) {
    const halfDayThreshold = getHalfDayThresholdTime(today)
    const absentThreshold = getAbsentThresholdTime(today)
    
    // Check if clocking in after 2:00 PM (Absent)
    if (now >= absentThreshold) {
      earlySignInMinutes = 0
      lateSignInMinutes = Math.round((now.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
      status = AttendanceStatus.Absent
    } 
    // Check if clocking in after 12:05 PM but before 2:00 PM (HalfDay)
    else if (now >= halfDayThreshold) {
      const diffMinutes = Math.round((now.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
      earlySignInMinutes = 0
      lateSignInMinutes = diffMinutes
      status = AttendanceStatus.HalfDay
    }
    // Check if clocking in after 10:05 AM but before 12:05 PM (Late)
    else if (checkIsLate(now, expectedLoginTime)) {
      const diffMinutes = Math.round((now.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
      earlySignInMinutes = 0
      lateSignInMinutes = diffMinutes
      status = AttendanceStatus.Late
    }
    // Clocking in on time or early (Present)
    else {
      const diffMinutes = Math.round((now.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
      if (diffMinutes < 0) {
        // Signed in early
        earlySignInMinutes = Math.abs(diffMinutes)
        lateSignInMinutes = 0
      } else {
        // Exactly on time (within 5 minutes)
        earlySignInMinutes = 0
        lateSignInMinutes = 0
      }
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
      logoutTime: null, // Clear logoutTime when clocking in again
      status,
      mode: attendanceMode,
      earlySignInMinutes,
      lateSignInMinutes,
      earlyLogoutMinutes: null, // Clear early logout minutes
      lateLogoutMinutes: null, // Clear late logout minutes
      totalHours: null, // Clear total hours (will be calculated on clock out)
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

  // Revalidate paths to refresh UI
  revalidatePath('/attendance')
  revalidatePath('/dashboard')

  // Notify specific super admins (raviteja and abhista) via WhatsApp
  try {
    console.log(`[WhatsApp] Clock-in event: ${user.name} (${session.user.id})`)
    
    const superAdmins = await prisma.user.findMany({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        phoneNumber: { not: null },
        email: { in: ['raviteja@techdr.in', 'abhista@techdr.in'] },
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
      },
    })

    console.log(`[WhatsApp] Found ${superAdmins.length} super admins to notify`)

    if (superAdmins.length > 0 && user.name) {
      const message = formatAttendanceNotificationMessage(
        user.name,
        'clock-in',
        now,
        attendanceMode
      )

      // Get template variables for template-based messages
      const templateVariables = getAttendanceNotificationTemplateVariables(
        user.name,
        'clock-in',
        now,
        attendanceMode
      )

      // Send notifications to specific super admins (raviteja and abhista) - don't wait for all to complete
      const notificationPromises = superAdmins
        .filter(admin => admin.phoneNumber)
        .map(admin => {
          console.log(`[WhatsApp] Sending clock-in notification to ${admin.name} (${admin.phoneNumber})`)
          return sendWhatsAppNotification(admin.phoneNumber!, message, templateVariables).then(result => {
            if (result.success) {
              console.log(`[WhatsApp] ✅ Clock-in notification sent to ${admin.name}. Message ID: ${result.messageId || 'N/A'}`)
            } else {
              console.error(`[WhatsApp] ❌ Failed to send clock-in notification to ${admin.name}: ${result.error}`)
            }
            return result
          }).catch(error => {
            console.error(`[WhatsApp] ❌ Error sending clock-in notification to ${admin.name}:`, error)
            return { success: false, error: error.message }
          })
        })

      // Fire and forget - don't block the response
      Promise.all(notificationPromises).catch(error => {
        console.error('[WhatsApp] Error sending attendance notifications:', error)
      })
    } else {
      console.log('[WhatsApp] No super admins found with phone numbers')
    }
  } catch (error) {
    // Don't fail the clock-in if notification fails
    console.error('[WhatsApp] Error notifying super admins of clock-in:', error)
  }

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

  // Verify user exists in database and get name
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true, name: true },
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

  let attendance = await prisma.attendances.findUnique({
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
    // Check if logoutTime is invalid (e.g., before loginTime, which shouldn't happen)
    // Or if loginTime is more recent than logoutTime (user clocked in again after clocking out)
    // In both cases, clear the old logoutTime and allow clock out
    if (attendance.loginTime > attendance.logoutTime) {
      // Invalid state or user clocked in again: clear old logoutTime and allow new clock out
      await prisma.attendances.update({
        where: { id: attendance.id },
        data: {
          logoutTime: null,
          totalHours: null,
          earlyLogoutMinutes: null,
          lateLogoutMinutes: null,
        },
      })
      // Re-fetch attendance after clearing invalid data
      attendance = await prisma.attendances.findUnique({
        where: {
          userId_date: {
            userId: session.user.id,
            date: today,
          },
        },
      })
      if (!attendance || !attendance.loginTime) {
        throw new Error('Failed to refresh attendance data')
      }
      // Continue with clock out after clearing invalid data
    } else {
      throw new Error('Already clocked out today. Please refresh the page to see your attendance status.')
    }
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
  
  // Subtract lunch break only if user worked through the lunch period
  if (attendance.mode === AttendanceMode.OFFICE) {
    const lunchStartTime = new Date(today)
    lunchStartTime.setHours(ATTENDANCE_CONFIG.LUNCH_START_HOUR, ATTENDANCE_CONFIG.LUNCH_START_MINUTE, 0, 0)
    
    // Only subtract lunch break if user clocked out after lunch start time
    // (meaning they worked through or past the lunch period)
    if (now >= lunchStartTime) {
      const lunchBreakHours = ATTENDANCE_CONFIG.LUNCH_DURATION_MINUTES / 60 // 30 minutes = 0.5 hours
      totalHours = totalHours - lunchBreakHours
    }
    
    // Ensure totalHours is not negative (in case of very early clock out)
    if (totalHours < 0) {
      totalHours = 0
    }
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

  // Revalidate paths to refresh UI
  revalidatePath('/attendance')
  revalidatePath('/dashboard')

  // Notify specific super admins (raviteja and abhista) via WhatsApp
  try {
    console.log(`[WhatsApp] Clock-out event: ${user.name} (${session.user.id})`)
    console.log(`[WhatsApp] Total hours worked: ${totalHours.toFixed(2)}`)
    
    const superAdmins = await prisma.user.findMany({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        phoneNumber: { not: null },
        email: { in: ['raviteja@techdr.in', 'abhista@techdr.in'] },
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
      },
    })

    console.log(`[WhatsApp] Found ${superAdmins.length} super admins to notify`)

    if (superAdmins.length > 0 && user.name) {
      const message = formatAttendanceNotificationMessage(
        user.name,
        'clock-out',
        now,
        updated.mode
      )

      // Get template variables for template-based messages
      const templateVariables = getAttendanceNotificationTemplateVariables(
        user.name,
        'clock-out',
        now,
        updated.mode
      )

      // Send notifications to specific super admins (raviteja and abhista) - don't wait for all to complete
      const notificationPromises = superAdmins
        .filter(admin => admin.phoneNumber)
        .map(admin => {
          console.log(`[WhatsApp] Sending clock-out notification to ${admin.name} (${admin.phoneNumber})`)
          return sendWhatsAppNotification(admin.phoneNumber!, message, templateVariables).then(result => {
            if (result.success) {
              console.log(`[WhatsApp] ✅ Clock-out notification sent to ${admin.name}. Message ID: ${result.messageId || 'N/A'}`)
            } else {
              console.error(`[WhatsApp] ❌ Failed to send clock-out notification to ${admin.name}: ${result.error}`)
            }
            return result
          }).catch(error => {
            console.error(`[WhatsApp] ❌ Error sending clock-out notification to ${admin.name}:`, error)
            return { success: false, error: error.message }
          })
        })

      // Fire and forget - don't block the response
      Promise.all(notificationPromises).catch(error => {
        console.error('[WhatsApp] Error sending attendance notifications:', error)
      })
    } else {
      console.log('[WhatsApp] No super admins found with phone numbers')
    }
  } catch (error) {
    // Don't fail the clock-out if notification fails
    console.error('[WhatsApp] Error notifying super admins of clock-out:', error)
  }

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

  // Revalidate paths to refresh UI
  revalidatePath('/attendance')
  revalidatePath('/dashboard')

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

  // Revalidate paths to refresh UI
  revalidatePath('/attendance')
  revalidatePath('/dashboard')

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

  // Revalidate paths to refresh UI
  revalidatePath('/attendance')
  revalidatePath('/dashboard')

  return {
    success: true,
    totalEmployees: employees.length,
    processed: results.length,
    errorCount: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export async function updateAttendanceMode(attendanceId: string, newMode: AttendanceMode) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!session.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admin can update attendance mode')
  }

  // Get the attendance record
  const attendance = await prisma.attendances.findUnique({
    where: { id: attendanceId },
  })

  if (!attendance) {
    throw new Error('Attendance record not found')
  }

  // If mode is the same, no need to update
  if (attendance.mode === newMode) {
    return {
      id: attendance.id,
      mode: attendance.mode,
      status: attendance.status,
    }
  }

  const now = new Date()
  const updateData: any = {
    mode: newMode,
    editedBy: session.user.id,
    editedAt: now,
  }

  // Handle mode conversion
  if (newMode === AttendanceMode.WFH) {
    // Converting to WFH mode
    updateData.earlySignInMinutes = null
    updateData.lateSignInMinutes = null
    updateData.earlyLogoutMinutes = null
    updateData.lateLogoutMinutes = null

    if (attendance.loginTime && !attendance.logoutTime) {
      // User is logged in but not logged out yet
      updateData.status = AttendanceStatus.Present // Will be recalculated on clock out
      updateData.lastActivityTime = now
      updateData.wfhActivityPings = 1
    } else if (attendance.loginTime && attendance.logoutTime && attendance.totalHours !== null) {
      // User has already clocked out - need to recalculate for WFH
      // Office mode subtracts lunch break (0.5 hours) if clocked out after lunch start, WFH doesn't
      const today = new Date(attendance.date)
      today.setHours(0, 0, 0, 0)
      const lunchStartTime = new Date(today)
      lunchStartTime.setHours(ATTENDANCE_CONFIG.LUNCH_START_HOUR, ATTENDANCE_CONFIG.LUNCH_START_MINUTE, 0, 0)
      
      let adjustedTotalHours = attendance.totalHours
      if (attendance.logoutTime >= lunchStartTime) {
        // Lunch break was subtracted for OFFICE mode, add it back for WFH
        adjustedTotalHours = attendance.totalHours + (ATTENDANCE_CONFIG.LUNCH_DURATION_MINUTES / 60)
      } else {
        // No lunch break was subtracted, recalculate from login/logout times for accuracy
        adjustedTotalHours = (attendance.logoutTime.getTime() - attendance.loginTime.getTime()) / (1000 * 60 * 60)
      }
      
      updateData.totalHours = adjustedTotalHours
      
      // Recalculate status: WFH requires >= 8.5 hours to be Present
      updateData.status = adjustedTotalHours >= ATTENDANCE_CONFIG.WFH_MIN_HOURS_FOR_PRESENT 
        ? AttendanceStatus.Present 
        : AttendanceStatus.Absent
      
      updateData.lastActivityTime = null
      updateData.wfhActivityPings = 0
    } else {
      // No login time or incomplete record
      updateData.status = AttendanceStatus.Present
      updateData.lastActivityTime = null
      updateData.wfhActivityPings = 0
    }
  } else if (newMode === AttendanceMode.OFFICE) {
    // Converting to OFFICE mode
    updateData.lastActivityTime = null
    updateData.wfhActivityPings = 0

    if (attendance.loginTime) {
      // Recalculate status based on login time for OFFICE mode
      const today = new Date(attendance.date)
      today.setHours(0, 0, 0, 0)
      const expectedLoginTime = getOfficeStartTime(today)
      const halfDayThreshold = getHalfDayThresholdTime(today)
      const absentThreshold = getAbsentThresholdTime(today)
      
      let status: AttendanceStatus = AttendanceStatus.Present
      let earlySignInMinutes: number | null = null
      let lateSignInMinutes: number | null = null

      if (attendance.loginTime >= absentThreshold) {
        earlySignInMinutes = 0
        lateSignInMinutes = Math.round((attendance.loginTime.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
        status = AttendanceStatus.Absent
      } else if (attendance.loginTime >= halfDayThreshold) {
        lateSignInMinutes = Math.round((attendance.loginTime.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
        status = AttendanceStatus.HalfDay
      } else if (checkIsLate(attendance.loginTime, expectedLoginTime)) {
        lateSignInMinutes = Math.round((attendance.loginTime.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
        status = AttendanceStatus.Late
      } else {
        const diffMinutes = Math.round((attendance.loginTime.getTime() - expectedLoginTime.getTime()) / (1000 * 60))
        if (diffMinutes < 0) {
          earlySignInMinutes = Math.abs(diffMinutes)
          lateSignInMinutes = 0
        } else {
          earlySignInMinutes = 0
          lateSignInMinutes = 0
        }
        status = AttendanceStatus.Present
      }

      updateData.status = status
      updateData.earlySignInMinutes = earlySignInMinutes
      updateData.lateSignInMinutes = lateSignInMinutes

      // If already clocked out, recalculate totalHours with lunch break subtraction
      if (attendance.logoutTime) {
        const today = new Date(attendance.date)
        today.setHours(0, 0, 0, 0)
        let totalHours = (attendance.logoutTime.getTime() - attendance.loginTime.getTime()) / (1000 * 60 * 60)
        
        const lunchStartTime = new Date(today)
        lunchStartTime.setHours(ATTENDANCE_CONFIG.LUNCH_START_HOUR, ATTENDANCE_CONFIG.LUNCH_START_MINUTE, 0, 0)
        
        if (attendance.logoutTime >= lunchStartTime) {
          const lunchBreakHours = ATTENDANCE_CONFIG.LUNCH_DURATION_MINUTES / 60
          totalHours = totalHours - lunchBreakHours
        }
        
        if (totalHours < 0) {
          totalHours = 0
        }
        
        updateData.totalHours = totalHours

        // Recalculate early/late logout minutes
        const expectedLogoutTime = new Date(today)
        expectedLogoutTime.setHours(ATTENDANCE_CONFIG.OFFICE_END_HOUR, ATTENDANCE_CONFIG.OFFICE_END_MINUTE, 0, 0)
        const diffMinutes = Math.round((attendance.logoutTime.getTime() - expectedLogoutTime.getTime()) / (1000 * 60))
        
        if (diffMinutes < 0) {
          updateData.earlyLogoutMinutes = Math.abs(diffMinutes)
          updateData.lateLogoutMinutes = 0
        } else if (diffMinutes > 0) {
          updateData.earlyLogoutMinutes = 0
          updateData.lateLogoutMinutes = diffMinutes
        } else {
          updateData.earlyLogoutMinutes = 0
          updateData.lateLogoutMinutes = 0
        }
      }
    }
  } else if (newMode === AttendanceMode.LEAVE) {
    // Converting to LEAVE mode
    updateData.status = AttendanceStatus.Present
    updateData.earlySignInMinutes = null
    updateData.lateSignInMinutes = null
    updateData.earlyLogoutMinutes = null
    updateData.lateLogoutMinutes = null
    updateData.lastActivityTime = null
    updateData.wfhActivityPings = 0
  }

  // Update the attendance record
  const updated = await prisma.attendances.update({
    where: { id: attendanceId },
    data: updateData,
  })

  await logActivity(session.user.id, 'UPDATE', 'Attendance', attendance.id)

  // Revalidate paths to refresh UI
  revalidatePath('/attendance')
  revalidatePath('/dashboard')

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

