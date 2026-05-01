import { formatDateLocal, parseDateLocal } from '@/lib/utils'

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
  dateField: string
): AttendanceLogDisplayStatus {
  const d = dateFromAttendanceLogField(dateField)
  if (isAttendanceNonWorkingCalendarDay(d)) return 'Holiday'
  if (rawStatus === 'Absent') return 'Absent'
  return 'Present'
}

/** Public holidays (YYYY-MM-DD). Keep in sync with payroll logic. */
export const ATTENDANCE_PUBLIC_HOLIDAY_DATES: string[] = [
  '2025-01-14',
  '2025-01-26',
  '2025-03-04',
  '2025-03-26',
  '2025-03-30',
  '2025-03-31',
  '2025-06-07',
  '2025-08-09',
  '2025-08-15',
  '2025-10-20',
  '2025-11-08',
  '2025-12-25',
]

export function isAttendanceSunday(date: Date): boolean {
  return date.getDay() === 0
}

export function isAttendancePublicHoliday(date: Date): boolean {
  return ATTENDANCE_PUBLIC_HOLIDAY_DATES.includes(formatDateLocal(date))
}

/** Sunday or configured public holiday (non-working calendar day). */
export function isAttendanceNonWorkingCalendarDay(date: Date): boolean {
  return isAttendanceSunday(date) || isAttendancePublicHoliday(date)
}
