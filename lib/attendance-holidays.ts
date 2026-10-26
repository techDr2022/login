import { parseDateLocal } from '@/lib/utils'
import { ATTENDANCE_TIMEZONE, getISTDateKey } from '@/lib/attendance-config'

/** Default company holidays (date + name). Safe to import from client components. */
export const ATTENDANCE_DEFAULT_HOLIDAYS: Array<{ date: string; name: string }> = [
  { date: '2025-01-14', name: 'Public Holiday' },
  { date: '2025-01-26', name: 'Republic Day' },
  { date: '2025-03-04', name: 'Public Holiday' },
  { date: '2025-03-26', name: 'Public Holiday' },
  { date: '2025-03-30', name: 'Public Holiday' },
  { date: '2025-03-31', name: 'Public Holiday' },
  { date: '2025-06-07', name: 'Public Holiday' },
  { date: '2025-08-09', name: 'Ganesh Chaturthi' },
  { date: '2025-08-15', name: 'Independence Day' },
  { date: '2025-10-20', name: 'Public Holiday' },
  { date: '2025-11-08', name: 'Public Holiday' },
  { date: '2025-12-25', name: 'Christmas' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-08-28', name: 'Rakhi Festival' },
]

export const ATTENDANCE_PUBLIC_HOLIDAY_DATES: string[] = ATTENDANCE_DEFAULT_HOLIDAYS.map(
  (holiday) => holiday.date
)

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

export function isAttendanceSunday(date: Date): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ATTENDANCE_TIMEZONE,
    weekday: 'short',
  }).format(date)
  return weekday === 'Sun'
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
