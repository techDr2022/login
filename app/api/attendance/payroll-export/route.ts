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
  return PUBLIC_HOLIDAYS.includes(formatDateLocal(date))
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getWorkingDaysInMonth(monthKey: string): number {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  const totalDays = new Date(year, monthIndex + 1, 0).getDate()
  let workingDays = 0

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, monthIndex, day)
    if (isSunday(date) || isPublicHoliday(date)) {
      continue
    }
    workingDays += 1
  }

  return workingDays
}

function formatTime(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  })
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    timeZone: 'Asia/Kolkata',
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
    const requestedStartKey = startDate
    const requestedEndKey = endDate

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
    const attendancesRaw = await prisma.attendances.findMany({
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
    const attendances = attendancesRaw.filter((attendance) => {
      const dateKey = formatDateLocal(attendance.date)
      return dateKey >= requestedStartKey && dateKey <= requestedEndKey
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

    const employeeIds = allEmployees.map((employee) => employee.id)
    const monthKeys = Array.from(
      new Set(
        (() => {
          const keys: string[] = []
          const cursor = new Date(start)
          while (cursor <= end) {
            keys.push(getMonthKey(cursor))
            cursor.setDate(cursor.getDate() + 1)
          }
          return keys
        })()
      )
    )

    const employeeSalaries = employeeIds.length
      ? await prisma.employeeSalary.findMany({
          where: {
            userId: { in: employeeIds },
            monthKey: { in: monthKeys },
            isActive: true,
          },
          select: {
            userId: true,
            monthKey: true,
            amount: true,
          },
        })
      : []

    const salaryMap = new Map(
      employeeSalaries.map((salary) => [`${salary.userId}-${salary.monthKey}`, salary.amount])
    )

    // Create a map of existing attendances
    const attendanceMap = new Map(
      attendances.map((a) => [`${a.userId}-${formatDateLocal(a.date)}`, a])
    )

    // Generate absent records for employees
    const allRecords: typeof attendances = [...attendances]
    
    for (const employee of allEmployees) {
      const currentDate = new Date(start)
      while (currentDate <= end) {
        const isoDate = formatDateLocal(currentDate)
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

    const monthlyWorkingDaysCache = new Map<string, number>()
    const payrollSummary = new Map<string, { name: string; presentDays: number; payableAmount: number }>()

    for (const employee of allEmployees) {
      payrollSummary.set(employee.id, {
        name: employee.name,
        presentDays: 0,
        payableAmount: 0,
      })
    }

    for (const attendance of allRecords) {
      const summary = payrollSummary.get(attendance.userId)
      if (!summary) continue

      const monthKey = getMonthKey(attendance.date)
      const salaryAmount = salaryMap.get(`${attendance.userId}-${monthKey}`) ?? 0
      const isSundayHoliday = (attendance as any).isSundayHoliday === true
      const isHoliday = isSundayHoliday || isPublicHoliday(attendance.date)
      if (isHoliday) continue

      let dayWeight = 0
      if (attendance.status === AttendanceStatus.Present || attendance.status === AttendanceStatus.Late) {
        dayWeight = 1
      } else if (attendance.status === AttendanceStatus.HalfDay) {
        dayWeight = 0.5
      }

      if (dayWeight <= 0) continue

      let monthWorkingDays = monthlyWorkingDaysCache.get(monthKey)
      if (!monthWorkingDays) {
        monthWorkingDays = getWorkingDaysInMonth(monthKey)
        monthlyWorkingDaysCache.set(monthKey, monthWorkingDays)
      }
      if (monthWorkingDays <= 0) continue

      const perDayPay = salaryAmount / monthWorkingDays
      summary.presentDays += dayWeight
      summary.payableAmount += perDayPay * dayWeight
    }

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
      const dayName = attendance.date.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: 'Asia/Kolkata',
      })
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

    worksheet.addRow([])
    worksheet.addRow(['Payroll Totals'])
    const totalsHeaderRow = worksheet.addRow(['Employee Name', 'Total Present Days', 'Payable Amount'])
    totalsHeaderRow.font = { bold: true }
    totalsHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    for (const employee of allEmployees.sort((a, b) => a.name.localeCompare(b.name))) {
      const summary = payrollSummary.get(employee.id)
      worksheet.addRow([
        employee.name,
        summary ? summary.presentDays.toFixed(2) : '0.00',
        summary ? summary.payableAmount.toFixed(2) : '0.00',
      ])
    }

    const summarySheet = workbook.addWorksheet('Payroll Summary', { views: [{ state: 'frozen', ySplit: 1 }] })
    const summaryHeaders = ['Employee Name', 'Total Present Days', 'Payable Amount']
    const summaryHeaderRow = summarySheet.addRow(summaryHeaders)
    summaryHeaderRow.font = { bold: true }
    summaryHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    for (const employee of allEmployees.sort((a, b) => a.name.localeCompare(b.name))) {
      const summary = payrollSummary.get(employee.id)
      summarySheet.addRow([
        employee.name,
        summary ? summary.presentDays.toFixed(2) : '0.00',
        summary ? summary.payableAmount.toFixed(2) : '0.00',
      ])
    }

    summarySheet.columns.forEach((col, i) => {
      let maxLength = summaryHeaders[i]?.length || 10
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? String(cell.value).length : 0
        maxLength = Math.max(maxLength, cellLength)
      })
      col.width = Math.min(maxLength + 2, 40)
    })

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
