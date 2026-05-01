export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AttendanceStatus, UserRole } from '@prisma/client'
import { formatDateLocal, parseDateLocal } from '@/lib/utils'
import { isAttendanceNonWorkingCalendarDay } from '@/lib/attendance-holidays'

function getMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function countWorkingDaysInRange(start: Date, end: Date): number {
  let workingDays = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    if (!isAttendanceNonWorkingCalendarDay(cursor)) {
      workingDays += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return workingDays
}

function countWorkingDaysInMonth(monthKey: string): number {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  const totalDays = new Date(year, monthIndex + 1, 0).getDate()
  let workingDays = 0

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day)
    if (!isAttendanceNonWorkingCalendarDay(date)) {
      workingDays += 1
    }
  }
  return workingDays
}

function getMonthKeysInRange(start: Date, end: Date): string[] {
  const monthKeys = new Set<string>()
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cursor <= endMonth) {
    monthKeys.add(getMonthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return Array.from(monthKeys)
}

function buildDateRange(searchParams: URLSearchParams): { start: Date; end: Date; startKey: string; endKey: string } {
  const now = new Date()
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
  defaultStart.setHours(0, 0, 0, 0)
  const defaultEnd = new Date(now)
  defaultEnd.setHours(23, 59, 59, 999)

  if (!startDateParam && !endDateParam) {
    return {
      start: defaultStart,
      end: defaultEnd,
      startKey: formatDateLocal(defaultStart),
      endKey: formatDateLocal(defaultEnd),
    }
  }

  if (!startDateParam || !endDateParam) {
    throw new Error('Both startDate and endDate are required when filtering by date range')
  }

  const start = parseDateLocal(startDateParam)
  const end = parseDateLocal(endDateParam)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid startDate or endDate')
  }
  if (start > end) {
    throw new Error('startDate must be before or equal to endDate')
  }
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff > 90) {
    throw new Error('Date range cannot exceed 90 days')
  }

  return { start, end, startKey: startDateParam, endKey: endDateParam }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || undefined
    const { start, end, startKey, endKey } = buildDateRange(searchParams)
    const monthKeys = getMonthKeysInRange(start, end)

    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        isActive: true,
        ...(userId && { id: userId }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const workingDays = countWorkingDaysInRange(start, end)
    if (employees.length === 0 || workingDays <= 0) {
      return NextResponse.json({
        startDate: startKey,
        endDate: endKey,
        workingDays,
        presentDays: 0,
        finalSalary: 0,
        employees: employees.map((e) => ({
          userId: e.id,
          name: e.name,
          payableDays: 0,
          paidLeaveDays: 0,
          unpaidAbsentDays: 0,
          payAmount: 0,
        })),
      })
    }

    const employeeIds = employees.map((employee) => employee.id)
    const attendanceRecordsRaw = await prisma.attendances.findMany({
      where: {
        userId: { in: employeeIds },
        date: { gte: start, lte: end },
      },
      select: {
        userId: true,
        date: true,
        status: true,
      },
    })
    const attendanceRecords = attendanceRecordsRaw.filter((record) => {
      const dateKey = formatDateLocal(record.date)
      return dateKey >= startKey && dateKey <= endKey
    })

    const salaryRows = await prisma.employeeSalary.findMany({
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
    const salaryMap = new Map(salaryRows.map((row) => [`${row.userId}-${row.monthKey}`, row.amount]))

    const attendanceMap = new Map<string, AttendanceStatus>()
    for (const attendance of attendanceRecords) {
      const key = `${attendance.userId}-${formatDateLocal(attendance.date)}`
      attendanceMap.set(key, attendance.status)
    }

    const monthWorkingDaysCache = new Map<string, number>()
    let presentDays = 0
    let finalSalary = 0

    const employeeRows: Array<{
      userId: string
      name: string
      payableDays: number
      paidLeaveDays: number
      unpaidAbsentDays: number
      payAmount: number
    }> = []

    for (const employee of employees) {
      const absentDaysByMonth = new Map<string, number>()
      const payableDaysByMonth = new Map<string, number>()
      const cursor = new Date(start)

      while (cursor <= end) {
        if (!isAttendanceNonWorkingCalendarDay(cursor)) {
          const dayKey = formatDateLocal(cursor)
          const monthKey = getMonthKey(cursor)
          const status = attendanceMap.get(`${employee.id}-${dayKey}`) ?? AttendanceStatus.Absent

          let dayWeight = 0
          if (status === AttendanceStatus.Present || status === AttendanceStatus.Late) {
            dayWeight = 1
          } else if (status === AttendanceStatus.HalfDay) {
            dayWeight = 0.5
          } else if (status === AttendanceStatus.Absent) {
            absentDaysByMonth.set(monthKey, (absentDaysByMonth.get(monthKey) ?? 0) + 1)
          }

          if (dayWeight > 0) {
            payableDaysByMonth.set(monthKey, (payableDaysByMonth.get(monthKey) ?? 0) + dayWeight)
          }
        }
        cursor.setDate(cursor.getDate() + 1)
      }

      for (const [monthKey, absentCount] of absentDaysByMonth) {
        const paidLeaveDays = Math.min(absentCount, 1)
        if (paidLeaveDays > 0) {
          payableDaysByMonth.set(monthKey, (payableDaysByMonth.get(monthKey) ?? 0) + paidLeaveDays)
        }
      }

      let employeePayable = 0
      let employeePay = 0
      let rawAbsent = 0
      let paidLeaveTotal = 0

      for (const [, absentCount] of absentDaysByMonth) {
        rawAbsent += absentCount
        paidLeaveTotal += Math.min(absentCount, 1)
      }

      for (const [monthKey, payableInMonth] of payableDaysByMonth) {
        if (payableInMonth <= 0) continue
        employeePayable += payableInMonth
        presentDays += payableInMonth

        const salaryAmount = salaryMap.get(`${employee.id}-${monthKey}`) ?? 0
        if (salaryAmount <= 0) continue

        let monthWorkingDays = monthWorkingDaysCache.get(monthKey)
        if (!monthWorkingDays) {
          monthWorkingDays = countWorkingDaysInMonth(monthKey)
          monthWorkingDaysCache.set(monthKey, monthWorkingDays)
        }
        if (monthWorkingDays <= 0) continue

        const perDayPay = salaryAmount / monthWorkingDays
        const monthPay = perDayPay * payableInMonth
        employeePay += monthPay
        finalSalary += monthPay
      }

      employeeRows.push({
        userId: employee.id,
        name: employee.name,
        payableDays: Number(employeePayable.toFixed(2)),
        paidLeaveDays: Number(paidLeaveTotal.toFixed(2)),
        unpaidAbsentDays: Number(Math.max(0, rawAbsent - paidLeaveTotal).toFixed(2)),
        payAmount: Number(employeePay.toFixed(2)),
      })
    }

    return NextResponse.json({
      startDate: startKey,
      endDate: endKey,
      workingDays,
      presentDays: Number(presentDays.toFixed(2)),
      finalSalary: Number(finalSalary.toFixed(2)),
      employees: employeeRows,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    if (
      message === 'Both startDate and endDate are required when filtering by date range' ||
      message === 'Invalid startDate or endDate' ||
      message === 'startDate must be before or equal to endDate' ||
      message === 'Date range cannot exceed 90 days'
    ) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    console.error('Failed to compute payroll summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
