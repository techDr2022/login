import { AttendanceStatus } from '@prisma/client'
import { getISTDateKey, dateAtISTWallClock } from '@/lib/attendance-config'
import { isAttendanceNonWorkingCalendarDay } from '@/lib/attendance-holidays'
import {
  applyPaidLeaveCarryForward,
  compareMonthKeys,
  getEmployeePaidLeaveStartMonthKey,
  getMonthKey,
  getMonthKeysBetween,
} from '@/lib/payroll-paid-leave'

export function getTodayISTDateKey(now = new Date()): string {
  return getISTDateKey(now)
}

export function isBeforeEmployeeJoinDate(dayKey: string, joiningDate: Date | null | undefined): boolean {
  if (!joiningDate) return false
  return dayKey < getISTDateKey(joiningDate)
}

export function countWorkingDaysInMonth(monthKey: string, holidayDates: ReadonlySet<string>): number {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  const totalDays = new Date(year, monthIndex + 1, 0).getDate()
  let workingDays = 0

  for (let day = 1; day <= totalDays; day += 1) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`
    const date = dateAtISTWallClock(dateKey, 12, 0)
    if (!isAttendanceNonWorkingCalendarDay(date, holidayDates)) {
      workingDays += 1
    }
  }

  return workingDays
}

export function countWorkingDaysInRange(
  start: Date,
  end: Date,
  holidayDates: ReadonlySet<string>,
  todayKey = getTodayISTDateKey()
): number {
  let workingDays = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endCopy = new Date(end)
  endCopy.setHours(23, 59, 59, 999)

  while (cursor <= endCopy) {
    const dayKey = getISTDateKey(cursor)
    if (dayKey >= todayKey) {
      cursor.setDate(cursor.getDate() + 1)
      continue
    }
    if (!isAttendanceNonWorkingCalendarDay(cursor, holidayDates)) {
      workingDays += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return workingDays
}

function getAttendanceDayWeight(status: AttendanceStatus): number {
  if (status === AttendanceStatus.Present || status === AttendanceStatus.Late) return 1
  if (status === AttendanceStatus.HalfDay) return 0.5
  return 0
}

/**
 * Resolve attendance for payroll. Returns null for future days and today without a record
 * (in-progress day should not reduce pay).
 */
function resolveDayStatus(
  dayKey: string,
  todayKey: string,
  recordStatus: AttendanceStatus | undefined
): AttendanceStatus | null {
  if (dayKey > todayKey) return null
  if (dayKey === todayKey && !recordStatus) return null
  return recordStatus ?? AttendanceStatus.Absent
}

function buildAttendanceStatusByDay(
  records: Array<{ date: Date; status: AttendanceStatus }>
): Map<string, AttendanceStatus> {
  const byDay = new Map<string, AttendanceStatus>()
  for (const record of records) {
    byDay.set(getISTDateKey(record.date), record.status)
  }
  return byDay
}

function buildAbsentDaysByMonthFromCalendar(
  attendanceByDay: Map<string, AttendanceStatus>,
  periodStart: Date,
  periodEnd: Date,
  joiningDate: Date | null | undefined,
  isWorkingDay: (date: Date) => boolean,
  todayKey: string
): Map<string, number> {
  const absentDaysByMonth = new Map<string, number>()
  const cursor = new Date(periodStart)
  cursor.setHours(0, 0, 0, 0)
  const endCopy = new Date(periodEnd)
  endCopy.setHours(23, 59, 59, 999)

  while (cursor <= endCopy) {
    const dayKey = getISTDateKey(cursor)
    if (isBeforeEmployeeJoinDate(dayKey, joiningDate)) {
      cursor.setDate(cursor.getDate() + 1)
      continue
    }
    if (!isWorkingDay(cursor)) {
      cursor.setDate(cursor.getDate() + 1)
      continue
    }
    if (dayKey >= todayKey) {
      cursor.setDate(cursor.getDate() + 1)
      continue
    }

    const status = resolveDayStatus(dayKey, todayKey, attendanceByDay.get(dayKey))
    if (status === AttendanceStatus.Absent) {
      const monthKey = getMonthKey(cursor)
      absentDaysByMonth.set(monthKey, (absentDaysByMonth.get(monthKey) ?? 0) + 1)
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return absentDaysByMonth
}

export type PayrollEmployeeInput = {
  id: string
  name: string
  joiningDate: Date | null
}

export type PayrollAttendanceRecord = {
  date: Date
  status: AttendanceStatus
}

export type PayrollEmployeeResult = {
  userId: string
  name: string
  payableDays: number
  paidLeaveDays: number
  unpaidAbsentDays: number
  carriedLeaveBalance: number
  monthlySalary: number
  payAmount: number
  workingDaysInRange: number
}

export function computeEmployeePayroll(params: {
  employee: PayrollEmployeeInput
  rangeStart: Date
  rangeEnd: Date
  rangeStartMonthKey: string
  rangeEndMonthKey: string
  monthKeysInRange: string[]
  holidayDates: ReadonlySet<string>
  attendanceInRange: PayrollAttendanceRecord[]
  attendanceForCarryForward: PayrollAttendanceRecord[]
  salaryByMonth: Map<string, number>
  simulationStart: Date
  todayKey?: string
}): PayrollEmployeeResult & { presentDaysContribution: number } {
  const {
    employee,
    rangeStart,
    rangeEnd,
    rangeStartMonthKey,
    rangeEndMonthKey,
    monthKeysInRange,
    holidayDates,
    attendanceInRange,
    attendanceForCarryForward,
    salaryByMonth,
    simulationStart,
    todayKey = getTodayISTDateKey(),
  } = params

  const isWorkingDay = (date: Date) => !isAttendanceNonWorkingCalendarDay(date, holidayDates)
  const attendanceInRangeByDay = buildAttendanceStatusByDay(attendanceInRange)
  const attendanceForCarryForwardByDay = buildAttendanceStatusByDay(attendanceForCarryForward)
  const employeeJoinMonthKey = getEmployeePaidLeaveStartMonthKey(employee.joiningDate)

  const payableDaysByMonth = new Map<string, number>()
  let workingDaysInRange = 0

  const rangeCursor = new Date(rangeStart)
  rangeCursor.setHours(0, 0, 0, 0)
  const rangeEndCopy = new Date(rangeEnd)
  rangeEndCopy.setHours(23, 59, 59, 999)

  while (rangeCursor <= rangeEndCopy) {
    const dayKey = getISTDateKey(rangeCursor)
    const monthKey = getMonthKey(rangeCursor)

    if (employeeJoinMonthKey && compareMonthKeys(monthKey, employeeJoinMonthKey) < 0) {
      rangeCursor.setDate(rangeCursor.getDate() + 1)
      continue
    }
    if (isBeforeEmployeeJoinDate(dayKey, employee.joiningDate)) {
      rangeCursor.setDate(rangeCursor.getDate() + 1)
      continue
    }
    if (!isWorkingDay(rangeCursor)) {
      rangeCursor.setDate(rangeCursor.getDate() + 1)
      continue
    }

    const status = resolveDayStatus(dayKey, todayKey, attendanceInRangeByDay.get(dayKey))
    if (status === null) {
      rangeCursor.setDate(rangeCursor.getDate() + 1)
      continue
    }

    workingDaysInRange += 1
    const dayWeight = getAttendanceDayWeight(status)
    if (dayWeight > 0) {
      payableDaysByMonth.set(monthKey, (payableDaysByMonth.get(monthKey) ?? 0) + dayWeight)
    }

    rangeCursor.setDate(rangeCursor.getDate() + 1)
  }

  const simulationEnd = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)
  const absentDaysByMonth = buildAbsentDaysByMonthFromCalendar(
    attendanceForCarryForwardByDay,
    simulationStart,
    rangeEnd,
    employee.joiningDate,
    isWorkingDay,
    todayKey
  )

  const simulationMonths = getMonthKeysBetween(simulationStart, simulationEnd).filter((monthKey) => {
    if (employeeJoinMonthKey && compareMonthKeys(monthKey, employeeJoinMonthKey) < 0) return false
    return true
  })

  const { paidLeaveByMonth, closingCarryForward } = applyPaidLeaveCarryForward(
    simulationMonths,
    absentDaysByMonth
  )

  let rawAbsentInRange = 0
  for (const [monthKey, absentCount] of absentDaysByMonth) {
    if (compareMonthKeys(monthKey, rangeStartMonthKey) < 0) continue
    if (compareMonthKeys(monthKey, rangeEndMonthKey) > 0) continue
    rawAbsentInRange += absentCount
  }

  let paidLeaveInRange = 0
  for (const [monthKey, paidLeaveDays] of paidLeaveByMonth) {
    if (compareMonthKeys(monthKey, rangeStartMonthKey) < 0) continue
    if (compareMonthKeys(monthKey, rangeEndMonthKey) > 0) continue
    paidLeaveInRange += paidLeaveDays
    payableDaysByMonth.set(monthKey, (payableDaysByMonth.get(monthKey) ?? 0) + paidLeaveDays)
  }

  const monthWorkingDaysCache = new Map<string, number>()
  let employeePayable = 0
  let employeePay = 0
  let presentDaysContribution = 0
  let monthlySalary = 0

  for (const monthKey of monthKeysInRange) {
    monthlySalary += salaryByMonth.get(monthKey) ?? 0
  }

  for (const [monthKey, payableInMonth] of payableDaysByMonth) {
    if (payableInMonth <= 0) continue
    employeePayable += payableInMonth
    presentDaysContribution += payableInMonth

    const salaryAmount = salaryByMonth.get(monthKey) ?? 0
    if (salaryAmount <= 0) continue

    let monthWorkingDays = monthWorkingDaysCache.get(monthKey)
    if (!monthWorkingDays) {
      monthWorkingDays = countWorkingDaysInMonth(monthKey, holidayDates)
      monthWorkingDaysCache.set(monthKey, monthWorkingDays)
    }
    if (monthWorkingDays <= 0) continue

    const perDayPay = salaryAmount / monthWorkingDays
    employeePay += perDayPay * payableInMonth
  }

  return {
    userId: employee.id,
    name: employee.name,
    payableDays: Number(employeePayable.toFixed(2)),
    paidLeaveDays: Number(paidLeaveInRange.toFixed(2)),
    unpaidAbsentDays: Number(Math.max(0, rawAbsentInRange - paidLeaveInRange).toFixed(2)),
    carriedLeaveBalance: Number(closingCarryForward.toFixed(2)),
    monthlySalary: Number(monthlySalary.toFixed(2)),
    payAmount: Number(employeePay.toFixed(2)),
    workingDaysInRange,
    presentDaysContribution,
  }
}
