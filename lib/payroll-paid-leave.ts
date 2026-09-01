/** Paid leave earned each calendar month. */
export const PAID_LEAVE_PER_MONTH = 1

/** Unused paid leave that can roll into the next month (max banked). */
export const PAID_LEAVE_MAX_CARRY_FORWARD = 1

export function getMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function compareMonthKeys(a: string, b: string): number {
  return a.localeCompare(b)
}

export function getMonthKeysBetween(start: Date, end: Date): string[] {
  const monthKeys: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cursor <= endMonth) {
    monthKeys.push(getMonthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return monthKeys
}

export function getEmployeePaidLeaveStartMonthKey(joiningDate: Date | null | undefined): string | null {
  if (!joiningDate) return null
  return getMonthKey(new Date(joiningDate))
}

/**
 * Apply monthly paid-leave accrual with carry-forward.
 * Each month earns 1 paid leave; unused balance (up to 1) carries to the next month.
 */
export function applyPaidLeaveCarryForward(
  monthKeysChronological: string[],
  absentDaysByMonth: ReadonlyMap<string, number>,
  openingCarryForward = 0
): {
  paidLeaveByMonth: Map<string, number>
  closingCarryForward: number
  totalPaidLeaveUsed: number
} {
  let carry = Math.min(openingCarryForward, PAID_LEAVE_MAX_CARRY_FORWARD)
  const paidLeaveByMonth = new Map<string, number>()
  let totalPaidLeaveUsed = 0

  for (const monthKey of monthKeysChronological) {
    const absents = absentDaysByMonth.get(monthKey) ?? 0
    const pool = carry + PAID_LEAVE_PER_MONTH
    const used = Math.min(absents, pool)

    if (used > 0) {
      paidLeaveByMonth.set(monthKey, used)
      totalPaidLeaveUsed += used
    }

    carry = Math.min(PAID_LEAVE_MAX_CARRY_FORWARD, Math.max(0, pool - used))
  }

  return { paidLeaveByMonth, closingCarryForward: carry, totalPaidLeaveUsed }
}

export function buildAbsentDaysByMonth(
  records: Array<{ date: Date; status: string }>,
  isWorkingDay: (date: Date) => boolean,
  absentStatus = 'Absent'
): Map<string, number> {
  const absentDaysByMonth = new Map<string, number>()

  for (const record of records) {
    if (record.status !== absentStatus) continue
    const date = new Date(record.date)
    if (!isWorkingDay(date)) continue
    const monthKey = getMonthKey(date)
    absentDaysByMonth.set(monthKey, (absentDaysByMonth.get(monthKey) ?? 0) + 1)
  }

  return absentDaysByMonth
}
