export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, AttendanceMode, AttendanceStatus } from '@prisma/client'
import { parseDateLocal, formatDateLocal } from '@/lib/utils'
import ExcelJS from 'exceljs'

// Public holiday configuration (dates in YYYY-MM-DD format).
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

function isPublicHoliday(date: Date): boolean {
  const isoDate = date.toISOString().split('T')[0]
  return PUBLIC_HOLIDAYS.includes(isoDate)
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

function formatTime(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  })
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admin can export payroll
    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId') || undefined

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const start = parseDateLocal(startDate)
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
    }

    const end = parseDateLocal(endDate)
    if (isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid end date' }, { status: 400 })
    }
    end.setHours(23, 59, 59, 999)

    // Limit date range to 3 months to avoid performance issues
    const maxDays = 90
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff > maxDays) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 90 days' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: any = {
      date: {
        gte: start,
        lte: end,
      },
    }

    if (userId) {
      where.userId = userId
    }

    // Fetch all attendance records for the date range
    const attendances = await prisma.attendances.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            jobTitle: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: [
        { User: { name: 'asc' } },
        { date: 'asc' },
      ],
    })

    // Get all employees to include absent records
    const allEmployees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        isActive: true,
        ...(userId && { id: userId }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        phoneNumber: true,
      },
    })

    // Create a map of existing attendances
    const attendanceMap = new Map(
      attendances.map((a) => [`${a.userId}-${a.date.toISOString().split('T')[0]}`, a])
    )

    // Generate absent records for employees
    const allRecords: typeof attendances = [...attendances]
    
    for (const employee of allEmployees) {
      const currentDate = new Date(start)
      while (currentDate <= end) {
        const isoDate = currentDate.toISOString().split('T')[0]
        const dateKey = `${employee.id}-${isoDate}`
        
        if (!attendanceMap.has(dateKey)) {
          const dateOnly = new Date(currentDate)
          dateOnly.setHours(0, 0, 0, 0)

          // Sunday: show as Holiday (orange), not Absent
          if (isSunday(dateOnly)) {
            allRecords.push({
              id: `holiday-${employee.id}-${isoDate}`,
              userId: employee.id,
              loginTime: null,
              logoutTime: null,
              lunchStart: null,
              lunchEnd: null,
              totalHours: null,
              date: dateOnly,
              status: AttendanceStatus.Absent,
              mode: AttendanceMode.OFFICE,
              earlySignInMinutes: null,
              lateSignInMinutes: null,
              earlyLogoutMinutes: null,
              lateLogoutMinutes: null,
              lastActivityTime: null,
              wfhActivityPings: 0,
              remark: null,
              editedBy: null,
              editedAt: null,
              ipAddress: null,
              deviceInfo: null,
              location: null,
              User: employee,
              isSundayHoliday: true,
            } as any)
          } else if (!isPublicHoliday(dateOnly)) {
            // Skip creating Absent records on public holidays (non-Sunday)
            allRecords.push({
              id: `absent-${employee.id}-${isoDate}`,
              userId: employee.id,
              loginTime: null,
              logoutTime: null,
              lunchStart: null,
              lunchEnd: null,
              totalHours: null,
              date: dateOnly,
              status: AttendanceStatus.Absent,
              mode: AttendanceMode.OFFICE,
              earlySignInMinutes: null,
              lateSignInMinutes: null,
              earlyLogoutMinutes: null,
              lateLogoutMinutes: null,
              lastActivityTime: null,
              wfhActivityPings: 0,
              remark: null,
              editedBy: null,
              editedAt: null,
              ipAddress: null,
              deviceInfo: null,
              location: null,
              User: employee,
            } as any)
          }
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    // Sort records by employee name and date
    allRecords.sort((a, b) => {
      const nameCompare = a.User.name.localeCompare(b.User.name)
      if (nameCompare !== 0) return nameCompare
      return a.date.getTime() - b.date.getTime()
    })

    // Generate Excel workbook with styling (Absent = red, Sunday Holiday = orange)
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Payroll Export', { views: [{ state: 'frozen', ySplit: 1 }] })

    const headers = [
      'Employee Name',
      'Email',
      'Job Title',
      'Date',
      'Day',
      'Status',
      'Mode',
      'Login Time',
      'Logout Time',
      'Total Hours',
      'Late Minutes',
      'Early Sign-in Minutes',
      'Early Logout Minutes',
      'WFH Activity Pings',
      'Remark',
      'Is Public Holiday',
      'Location',
    ]

    // Add header row with bold styling
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    // Status column index (0-based)
    const statusColIndex = 5

    // Add data rows
    for (const attendance of allRecords) {
      const dayName = attendance.date.toLocaleDateString('en-US', { weekday: 'long' })
      const isHoliday = isPublicHoliday(attendance.date)
      const isSundayHoliday = (attendance as any).isSundayHoliday === true
      const status = attendance.status
      const isAbsent = status === AttendanceStatus.Absent && !isSundayHoliday
      const displayStatus = isSundayHoliday ? 'Holiday' : status

      const row = worksheet.addRow([
        attendance.User.name,
        attendance.User.email || '',
        attendance.User.jobTitle || '',
        formatDate(attendance.date),
        dayName,
        displayStatus,
        attendance.mode,
        formatTime(attendance.loginTime),
        formatTime(attendance.logoutTime),
        attendance.totalHours?.toFixed(2) || '',
        attendance.lateSignInMinutes?.toString() || '0',
        attendance.earlySignInMinutes?.toString() || '0',
        attendance.earlyLogoutMinutes?.toString() || '0',
        attendance.wfhActivityPings?.toString() || '0',
        attendance.remark || '',
        isHoliday || isSundayHoliday ? 'Yes' : 'No',
        attendance.location || '',
      ])

      const statusCell = row.getCell(statusColIndex + 1) // exceljs uses 1-based
      if (isSundayHoliday) {
        // Sunday holiday: orange
        statusCell.font = { color: { argb: 'FFFF8C00' }, bold: true } // Orange, bold
      } else if (isAbsent) {
        // Absent: red
        statusCell.font = { color: { argb: 'FFFF0000' }, bold: true } // Red, bold
      }
    }

    // Auto-fit columns
    worksheet.columns.forEach((col, i) => {
      let maxLength = headers[i]?.length || 10
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? String(cell.value).length : 0
        maxLength = Math.max(maxLength, cellLength)
      })
      col.width = Math.min(maxLength + 2, 50)
    })

    const buffer = await workbook.xlsx.writeBuffer()

    // Generate filename with date range and employee name if filtered
    const startDateStr = formatDateLocal(start)
    const endDateStr = formatDateLocal(end)
    let filename = `payroll-export-${startDateStr}-to-${endDateStr}`
    
    // If filtering by specific employee, add employee name to filename
    if (userId && allEmployees.length === 1) {
      const employeeName = allEmployees[0].name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      filename += `-${employeeName}`
    }
    
    filename += '.xlsx'

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting payroll:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
