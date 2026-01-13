export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole, AttendanceMode } from '@prisma/client'
import { ATTENDANCE_CONFIG } from '@/lib/attendance-config'
import { 
  sendWhatsAppNotification, 
  formatWFHInactivityWarningMessage, 
  getWFHInactivityWarningTemplateVariables 
} from '@/lib/whatsapp'

/**
 * WFH Inactivity Check Cron Job
 * 
 * This endpoint should be called periodically (every 30-60 minutes) to check
 * for WFH employees who have been inactive for more than the threshold period
 * and notify administrators.
 * 
 * For Vercel Cron, add this to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/wfh-inactivity-check",
 *     "schedule": "0,30 * * * *"  // Every 30 minutes (at :00 and :30)
 *   }]
 * }
 * 
 * For manual testing, you can call: GET /api/cron/wfh-inactivity-check?secret=<CRON_SECRET>
 */

function isPublicHoliday(date: Date): boolean {
  // Public holiday configuration (dates in YYYY-MM-DD format)
  const PUBLIC_HOLIDAYS: string[] = [
    '2025-01-14', // Sankranthi Festival
    '2025-01-26', // Republic Day
    '2025-03-04', // Holi Festival
    '2025-03-26', // Ram Navami
    '2025-03-30', // Ugadhi
    '2025-03-31', // Ramadan
    '2025-06-07', // Bakrid
    '2025-08-09', // Ganesh Chaturthi
    '2025-08-15', // Independence Day
    '2025-10-20', // Dussehra
    '2025-11-08', // Diwali (Deepavali)
    '2025-12-25', // Christmas Day
  ]
  const isoDate = date.toISOString().split('T')[0]
  return PUBLIC_HOLIDAYS.includes(isoDate)
}

export async function GET(request: NextRequest) {
  try {
    // Optional: Add secret key for security (recommended for production)
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && secret !== cronSecret) {
      console.error('[WFH Inactivity Check] ❌ Unauthorized: Invalid secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current date
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    // Check if today is a public holiday (optional - may want to check WFH even on holidays)
    // Uncomment if you want to skip on holidays:
    // if (isPublicHoliday(today)) {
    //   console.log('[WFH Inactivity Check] ⏭️ Skipping check - today is a public holiday')
    //   return NextResponse.json({
    //     success: true,
    //     message: 'Skipped - public holiday',
    //     skipped: true,
    //   })
    // }

    console.log('[WFH Inactivity Check] 🔍 Starting WFH inactivity check...')

    // Get all WFH attendance records for today that are clocked in but not clocked out
    const wfhAttendances = await prisma.attendances.findMany({
      where: {
        date: today,
        mode: AttendanceMode.WFH,
        loginTime: { not: null }, // Must be clocked in
        logoutTime: null, // Must not be clocked out
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    console.log(`[WFH Inactivity Check] Found ${wfhAttendances.length} active WFH employees`)

    if (wfhAttendances.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active WFH employees found',
        employeesChecked: 0,
        inactiveEmployees: 0,
        notificationsSent: 0,
      })
    }

    // Check each attendance for inactivity
    const inactiveEmployees: Array<{
      userId: string
      userName: string
      email: string
      lastActivityTime: Date | null
      minutesInactive: number
      activityScore: number
      wfhActivityPings: number
    }> = []

    for (const attendance of wfhAttendances) {
      if (!attendance.loginTime || !attendance.lastActivityTime) {
        // No activity yet, skip (just clocked in)
        continue
      }

      const lastActivity = new Date(attendance.lastActivityTime)
      const minutesSinceLastActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60)

      // Check if inactive for more than threshold
      if (minutesSinceLastActivity >= ATTENDANCE_CONFIG.WFH_INACTIVITY_THRESHOLD_MINUTES) {
        // Calculate activity score
        const loginTime = new Date(attendance.loginTime)
        const hoursSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60)
        const expectedPings = Math.floor(hoursSinceLogin / (ATTENDANCE_CONFIG.WFH_ACTIVITY_PING_INTERVAL_MINUTES / 60))
        const actualPings = attendance.wfhActivityPings || 0
        const activityScore = expectedPings > 0 
          ? Math.min(100, Math.round((actualPings / expectedPings) * 100))
          : 100

        inactiveEmployees.push({
          userId: attendance.userId,
          userName: attendance.User.name,
          email: attendance.User.email,
          lastActivityTime: attendance.lastActivityTime,
          minutesInactive: Math.round(minutesSinceLastActivity),
          activityScore,
          wfhActivityPings: attendance.wfhActivityPings || 0,
        })

        console.log(
          `[WFH Inactivity Check] ⚠️ Found inactive employee: ${attendance.User.name} ` +
          `(inactive for ${Math.round(minutesSinceLastActivity)} minutes, score: ${activityScore}%)`
        )
      }
    }

    if (inactiveEmployees.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All WFH employees are active',
        employeesChecked: wfhAttendances.length,
        inactiveEmployees: 0,
        notificationsSent: 0,
      })
    }

    // Get all super admins to notify
    const superAdmins = await prisma.user.findMany({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        phoneNumber: { not: null }, // Only admins with phone numbers
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
      },
    })

    console.log(`[WFH Inactivity Check] Found ${superAdmins.length} super admins to notify`)

    // Send notifications to super admins about inactive employees
    const notificationsSent: Array<{
      adminId: string
      adminName: string
      employeeName: string
      success: boolean
      messageId?: string
      error?: string
    }> = []

    const errors: Array<{
      adminId: string
      adminName: string
      employeeName: string
      error: string
    }> = []

    // Send notification for each inactive employee to all super admins
    for (const employee of inactiveEmployees) {
      for (const admin of superAdmins) {
        if (!admin.phoneNumber) {
          continue
        }

        try {
          const message = formatWFHInactivityWarningMessage(
            employee.userName,
            employee.minutesInactive,
            employee.lastActivityTime || undefined,
            employee.activityScore
          )

          const templateVariables = getWFHInactivityWarningTemplateVariables(
            employee.userName,
            employee.minutesInactive,
            employee.lastActivityTime || undefined,
            employee.activityScore
          )

          console.log(
            `[WFH Inactivity Check] 📱 Notifying ${admin.name} about inactive employee: ${employee.userName}`
          )

          const result = await sendWhatsAppNotification(
            admin.phoneNumber,
            message,
            templateVariables
          )

          if (result.success) {
            console.log(
              `[WFH Inactivity Check] ✅ Notification sent to ${admin.name} about ${employee.userName}. ` +
              `Message ID: ${result.messageId || 'N/A'}`
            )
            notificationsSent.push({
              adminId: admin.id,
              adminName: admin.name,
              employeeName: employee.userName,
              success: true,
              messageId: result.messageId,
            })
          } else {
            console.error(
              `[WFH Inactivity Check] ❌ Failed to notify ${admin.name} about ${employee.userName}: ${result.error}`
            )
            errors.push({
              adminId: admin.id,
              adminName: admin.name,
              employeeName: employee.userName,
              error: result.error || 'Unknown error',
            })
          }
        } catch (error: any) {
          console.error(
            `[WFH Inactivity Check] ❌ Error notifying ${admin.name} about ${employee.userName}:`,
            error
          )
          errors.push({
            adminId: admin.id,
            adminName: admin.name,
            employeeName: employee.userName,
            error: error.message || 'Unknown error',
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${wfhAttendances.length} WFH employees, found ${inactiveEmployees.length} inactive`,
      employeesChecked: wfhAttendances.length,
      inactiveEmployees: inactiveEmployees.length,
      notificationsSent: notificationsSent.length,
      errorsCount: errors.length,
      inactiveEmployeesList: inactiveEmployees.map(emp => ({
        userId: emp.userId,
        userName: emp.userName,
        email: emp.email,
        minutesInactive: emp.minutesInactive,
        activityScore: emp.activityScore,
        wfhActivityPings: emp.wfhActivityPings,
        lastActivityTime: emp.lastActivityTime?.toISOString() || null,
      })),
      notifications: notificationsSent.length > 0 ? notificationsSent : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[WFH Inactivity Check] ❌ Error in WFH inactivity check cron:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}
