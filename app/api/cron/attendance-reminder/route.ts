export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { sendWhatsAppNotification, formatAttendanceReminderMessage, getAttendanceReminderTemplateVariables } from '@/lib/whatsapp'

/**
 * Attendance Reminder Cron Job
 * 
 * This endpoint should be called daily at 10:20 AM IST to send WhatsApp reminders
 * to employees who haven't clocked in yet.
 * 
 * For Vercel Cron, add this to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/attendance-reminder",
 *     "schedule": "20 10 * * *"
 *   }]
 * }
 * 
 * For manual testing, you can call: GET /api/cron/attendance-reminder?secret=<CRON_SECRET>
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
      console.error('[Attendance Reminder] ❌ Unauthorized: Invalid secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current date in IST (India Standard Time)
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    // Check if today is a public holiday
    if (isPublicHoliday(today)) {
      console.log('[Attendance Reminder] ⏭️ Skipping reminder - today is a public holiday')
      return NextResponse.json({
        success: true,
        message: 'Skipped - public holiday',
        skipped: true,
      })
    }

    // Get current time in IST (India Standard Time)
    // IST is UTC+5:30
    // Convert UTC time to IST by formatting in IST timezone
    const istTimeString = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const [currentHour, currentMinute] = istTimeString.split(':').map(Number)

    // Only run if it's around 10:20 AM IST (allow 10 minute window: 10:15 - 10:25)
    // This prevents accidental runs at wrong times
    // If called manually or at wrong time, skip
    if (currentHour !== 10 || (currentMinute < 15 || currentMinute > 25)) {
      console.log(`[Attendance Reminder] ⏭️ Skipping reminder - current IST time is ${currentHour}:${currentMinute.toString().padStart(2, '0')} (expected: 10:20 AM IST)`)
      return NextResponse.json({
        success: true,
        message: `Skipped - not the right time (current IST: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, expected: 10:20 AM IST)`,
        skipped: true,
        currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')} IST`,
      })
    }

    console.log('[Attendance Reminder] 🔔 Starting attendance reminder check...')

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        isActive: true,
        phoneNumber: { not: null }, // Only employees with phone numbers
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
      },
    })

    console.log(`[Attendance Reminder] Found ${employees.length} active employees with phone numbers`)

    if (employees.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No employees found with phone numbers',
        employeesChecked: 0,
        remindersSent: 0,
      })
    }

    // Get all attendance records for today
    const todayAttendances = await prisma.attendances.findMany({
      where: {
        date: today,
        loginTime: { not: null }, // Only those who have clocked in
      },
      select: {
        userId: true,
      },
    })

    const clockedInUserIds = new Set(todayAttendances.map(a => a.userId))
    console.log(`[Attendance Reminder] Found ${clockedInUserIds.size} employees who have already clocked in`)

    // Find employees who haven't clocked in
    const employeesNotClockedIn = employees.filter(emp => !clockedInUserIds.has(emp.id))

    console.log(`[Attendance Reminder] Found ${employeesNotClockedIn.length} employees who haven't clocked in`)

    if (employeesNotClockedIn.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All employees have clocked in',
        employeesChecked: employees.length,
        remindersSent: 0,
      })
    }

    // Send WhatsApp reminders
    const results = []
    const errors = []

    for (const employee of employeesNotClockedIn) {
      if (!employee.phoneNumber) {
        console.warn(`[Attendance Reminder] ⚠️ Skipping ${employee.name} - no phone number`)
        continue
      }

      try {
        const message = formatAttendanceReminderMessage(employee.name)
        const templateVariables = getAttendanceReminderTemplateVariables(employee.name)

        console.log(`[Attendance Reminder] 📱 Sending reminder to ${employee.name} (${employee.phoneNumber})`)

        const result = await sendWhatsAppNotification(
          employee.phoneNumber,
          message,
          templateVariables
        )

        if (result.success) {
          console.log(`[Attendance Reminder] ✅ Reminder sent to ${employee.name}. Message ID: ${result.messageId || 'N/A'}`)
          results.push({
            employeeId: employee.id,
            employeeName: employee.name,
            phoneNumber: employee.phoneNumber,
            success: true,
            messageId: result.messageId,
          })
        } else {
          console.error(`[Attendance Reminder] ❌ Failed to send reminder to ${employee.name}: ${result.error}`)
          errors.push({
            employeeId: employee.id,
            employeeName: employee.name,
            phoneNumber: employee.phoneNumber,
            error: result.error,
          })
        }
      } catch (error: any) {
        console.error(`[Attendance Reminder] ❌ Error sending reminder to ${employee.name}:`, error)
        errors.push({
          employeeId: employee.id,
          employeeName: employee.name,
          phoneNumber: employee.phoneNumber,
          error: error.message || 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reminders sent to ${results.length} employees`,
      employeesChecked: employees.length,
      employeesNotClockedIn: employeesNotClockedIn.length,
      remindersSent: results.length,
      errorsCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[Attendance Reminder] ❌ Error in attendance reminder cron:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}

