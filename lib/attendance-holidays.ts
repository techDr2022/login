import { parseDateLocal } from '@/lib/utils'
import {
  listAttendanceHolidayRows,
  seedDefaultAttendanceHolidaysIfEmpty,
  ATTENDANCE_PUBLIC_HOLIDAY_DATES,
  ATTENDANCE_DEFAULT_HOLIDAYS,
} from '@/lib/attendance-holiday-db'
import { getISTDateKey } from '@/lib/attendance-config'

export { ATTENDANCE_PUBLIC_HOLIDAY_DATES, ATTENDANCE_DEFAULT_HOLIDAYS }

export type AttendanceLogDisplayStatus = 'Present' | 'Absent' | 'Holiday'

/** Parse API/log date (prefer YYYY-MM-DD) for calendar checks without UTC drift. */
export function dateFromAttendanceLogField(dateField: string): Date {
  const ymd = dateField.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return parseDateLocal(ymd)
  }
  return new Date(dateField)
}

/** Present / Absent / Holiday for dashboards (Late & HalfDay count as Present on working days). */
export function getAttendanceDisplayStatus(
  rawStatus: string,
  dateField: string,
  holidayDates?: ReadonlySet<string>
): AttendanceLogDisplayStatus {
  const d = dateFromAttendanceLogField(dateField)
  if (isAttendanceNonWorkingCalendarDay(d, holidayDates)) return 'Holiday'
  if (rawStatus === 'Absent') return 'Absent'
  return 'Present'
}

let holidayCache: { dates: Set<string>; loadedAt: number } | null = null
const HOLIDAY_CACHE_TTL_MS = 30_000

export function invalidateAttendanceHolidayCache(): void {
  holidayCache = null
}

async function seedDefaultHolidaysIfEmpty(): Promise<void> {
  await seedDefaultAttendanceHolidaysIfEmpty()
}

export async function getAttendanceHolidayDateKeys(): Promise<Set<string>> {
  const now = Date.now()
  if (holidayCache && now - holidayCache.loadedAt < HOLIDAY_CACHE_TTL_MS) {
    return holidayCache.dates
  }

  try {
    await seedDefaultHolidaysIfEmpty()
    const rows = await listAttendanceHolidayRows()
    const dates = new Set(rows.map((row) => getISTDateKey(row.date)))
    holidayCache = { dates, loadedAt: now }
    return dates
  } catch {
    const dates = new Set(ATTENDANCE_PUBLIC_HOLIDAY_DATES)
    holidayCache = { dates, loadedAt: now }
    return dates
  }
}

export function isAttendanceSunday(date: Date): boolean {
  return date.getDay() === 0
}

export function isAttendancePublicHoliday(
  date: Date,
  holidayDates?: ReadonlySet<string>
): boolean {
  const key = getISTDateKey(date)
  if (holidayDates) {
    return holidayDates.has(key)
  }
  return ATTENDANCE_PUBLIC_HOLIDAY_DATES.includes(key)
}

/** Sunday or configured public holiday (non-working calendar day). */
export function isAttendanceNonWorkingCalendarDay(
  date: Date,
  holidayDates?: ReadonlySet<string>
): boolean {
  return isAttendanceSunday(date) || isAttendancePublicHoliday(date, holidayDates)
}
