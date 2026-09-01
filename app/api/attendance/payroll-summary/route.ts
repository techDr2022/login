export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { formatDateLocal, parseDateLocal } from '@/lib/utils'
import { getAttendanceHolidayDateKeys } from '@/lib/attendance-holidays'
import { getMonthKey, getMonthKeysBetween } from '@/lib/payroll-paid-leave'
import {
  computeEmployeePayroll,
  countWorkingDaysInRange,
  getTodayISTDateKey,
} from '@/lib/payroll-calculations'

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
    const monthKeys = getMonthKeysBetween(start, end)
    const holidayDates = await getAttendanceHolidayDateKeys()
    const todayKey = getTodayISTDateKey()

    const employees = await prisma.user.findMany({
      where: {
        role: UserRole.EMPLOYEE,
        isActive: true,
        ...(userId && { id: userId }),
      },
      select: { id: true, name: true, joiningDate: true },
      orderBy: { name: 'asc' },
    })

    const workingDays = countWorkingDaysInRange(start, end, holidayDates, todayKey)
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
          carriedLeaveBalance: 0,
          monthlySalary: 0,
          workingDaysInRange: 0,
          payAmount: 0,
        })),
      })
    }

    const rangeStartMonthKey = getMonthKey(start)
    const rangeEndMonthKey = getMonthKey(end)

    const simulationStart = employees.reduce((earliest, employee) => {
      if (!employee.joiningDate) return earliest
      const joinMonthStart = new Date(employee.joiningDate)
      joinMonthStart.setDate(1)
      joinMonthStart.setHours(0, 0, 0, 0)
      if (!earliest || joinMonthStart < earliest) return joinMonthStart
      return earliest
    }, null as Date | null) ?? new Date(start.getFullYear(), start.getMonth(), 1)

    const employeeIds = employees.map((employee) => employee.id)
    const attendanceRecordsRaw = await prisma.attendances.findMany({
      where: {
        userId: { in: employeeIds },
        date: { gte: simulationStart, lte: end },
      },
      select: {
        userId: true,
        date: true,
        status: true,
      },
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

    const salaryByEmployeeMonth = new Map<string, Map<string, number>>()
    for (const row of salaryRows) {
      const employeeSalaries = salaryByEmployeeMonth.get(row.userId) ?? new Map<string, number>()
      employeeSalaries.set(row.monthKey, row.amount)
      salaryByEmployeeMonth.set(row.userId, employeeSalaries)
    }

    const attendanceByEmployeeAll = new Map<string, Array<{ date: Date; status: typeof attendanceRecordsRaw[0]['status'] }>>()
    const attendanceByEmployeeInRange = new Map<string, Array<{ date: Date; status: typeof attendanceRecordsRaw[0]['status'] }>>()

    for (const attendance of attendanceRecordsRaw) {
      const allList = attendanceByEmployeeAll.get(attendance.userId) ?? []
      allList.push({ date: attendance.date, status: attendance.status })
      attendanceByEmployeeAll.set(attendance.userId, allList)

      const dateKey = formatDateLocal(attendance.date)
      if (dateKey >= startKey && dateKey <= endKey) {
        const rangeList = attendanceByEmployeeInRange.get(attendance.userId) ?? []
        rangeList.push({ date: attendance.date, status: attendance.status })
        attendanceByEmployeeInRange.set(attendance.userId, rangeList)
      }
    }

    let presentDays = 0
    let finalSalary = 0

    const employeeRows = employees.map((employee) => {
      const result = computeEmployeePayroll({
        employee,
        rangeStart: start,
        rangeEnd: end,
        rangeStartMonthKey,
        rangeEndMonthKey,
        monthKeysInRange: monthKeys,
        holidayDates,
        attendanceInRange: attendanceByEmployeeInRange.get(employee.id) ?? [],
        attendanceForCarryForward: attendanceByEmployeeAll.get(employee.id) ?? [],
        salaryByMonth: salaryByEmployeeMonth.get(employee.id) ?? new Map(),
        simulationStart,
        todayKey,
      })

      presentDays += result.presentDaysContribution
      finalSalary += result.payAmount

      return {
        userId: result.userId,
        name: result.name,
        payableDays: result.payableDays,
        paidLeaveDays: result.paidLeaveDays,
        unpaidAbsentDays: result.unpaidAbsentDays,
        carriedLeaveBalance: result.carriedLeaveBalance,
        monthlySalary: result.monthlySalary,
        workingDaysInRange: result.workingDaysInRange,
        payAmount: result.payAmount,
      }
    })

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
