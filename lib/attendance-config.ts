/** All attendance day boundaries and office hours use India Standard Time. */
export const ATTENDANCE_TIMEZONE = 'Asia/Kolkata'

// Attendance Configuration Constants
export const ATTENDANCE_CONFIG = {
  // Office Hours
  OFFICE_START_HOUR: 10,
  OFFICE_START_MINUTE: 0,
  OFFICE_END_HOUR: 19, // 7:00 PM
  OFFICE_END_MINUTE: 0,
  
  // Lunch Break
  LUNCH_START_HOUR: 13, // 1:00 PM
  LUNCH_START_MINUTE: 0,
  LUNCH_END_HOUR: 13, // 1:30 PM
  LUNCH_END_MINUTE: 30,
  LUNCH_DURATION_MINUTES: 30,
  
  // Late Threshold (in minutes after office start time)
  LATE_THRESHOLD_MINUTES: 5, // After 10:05 AM is considered late
  
  // Half Day Threshold (in hours:minutes)
  HALF_DAY_HOUR: 12,
  HALF_DAY_MINUTE: 5, // After 12:05 PM is considered half day
  
  // Absent Threshold (in hours:minutes)
  ABSENT_HOUR: 14,
  ABSENT_MINUTE: 0, // After 2:00 PM is considered absent
  
  // Minimum working hours for WFH to be considered Present
  WFH_MIN_HOURS_FOR_PRESENT: 8.5,
  
  // Employment Types
  EMPLOYMENT_TYPES: {
    OFFICE: 'Office',
    WFH: 'WFH',
    HYBRID: 'Hybrid',
  } as const,
} as const

export function getISTDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ATTENDANCE_TIMEZONE })
}

export function dateAtISTWallClock(dateKey: string, hour: number, minute: number, second = 0): Date {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  const ss = String(second).padStart(2, '0')
  return new Date(`${dateKey}T${hh}:${mm}:${ss}+05:30`)
}

/** Start of the calendar day containing `date`, in IST. */
export function getISTDayStart(date: Date): Date {
  return dateAtISTWallClock(getISTDateKey(date), 0, 0, 0)
}

/**
 * PostgreSQL DATE value for an IST calendar day.
 * Stored as UTC midnight of the YYYY-MM-DD key so queries match regardless of server TZ.
 */
export function getAttendanceDateForDB(date: Date): Date {
  return new Date(`${getISTDateKey(date)}T00:00:00.000Z`)
}

/** 6:00 PM IST on the calendar day of `date`. */
export function endOfBusinessDayIST(date: Date): Date {
  return dateAtISTWallClock(getISTDateKey(date), 18, 0, 0)
}

export function istHour(date: Date): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: ATTENDANCE_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).format(date)
  return Number(hour)
}

/** Date-only values and multi-day durations land at 6:00 PM IST. */
export function normalizeTaskDueDate(start: Date, candidate: Date, durationHours?: number): Date {
  const crossesDay =
    durationHours === undefined
      ? istHour(candidate) < 9
      : durationHours >= 24 || getISTDateKey(candidate) !== getISTDateKey(start)
  if (!crossesDay) return candidate
  return endOfBusinessDayIST(candidate)
}

export function isBeforeIstToday(date: Date): boolean {
  return getISTDateKey(date) < getISTDateKey(new Date())
}

/** Parse YYYY-MM-DD as the attendance DATE column value (UTC midnight). */
export function parseAttendanceDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

export function getOfficeStartTime(date: Date): Date {
  return dateAtISTWallClock(
    getISTDateKey(date),
    ATTENDANCE_CONFIG.OFFICE_START_HOUR,
    ATTENDANCE_CONFIG.OFFICE_START_MINUTE
  )
}

export function getOfficeEndTime(date: Date): Date {
  return dateAtISTWallClock(
    getISTDateKey(date),
    ATTENDANCE_CONFIG.OFFICE_END_HOUR,
    ATTENDANCE_CONFIG.OFFICE_END_MINUTE
  )
}

export function getLunchStartTime(date: Date): Date {
  return dateAtISTWallClock(
    getISTDateKey(date),
    ATTENDANCE_CONFIG.LUNCH_START_HOUR,
    ATTENDANCE_CONFIG.LUNCH_START_MINUTE
  )
}

export function getLunchEndTime(date: Date): Date {
  return dateAtISTWallClock(
    getISTDateKey(date),
    ATTENDANCE_CONFIG.LUNCH_END_HOUR,
    ATTENDANCE_CONFIG.LUNCH_END_MINUTE
  )
}

export function isLate(checkInTime: Date, officeStartTime: Date): boolean {
  const diffMinutes = Math.round((checkInTime.getTime() - officeStartTime.getTime()) / (1000 * 60))
  return diffMinutes > ATTENDANCE_CONFIG.LATE_THRESHOLD_MINUTES
}

export function getHalfDayThresholdTime(date: Date): Date {
  return dateAtISTWallClock(
    getISTDateKey(date),
    ATTENDANCE_CONFIG.HALF_DAY_HOUR,
    ATTENDANCE_CONFIG.HALF_DAY_MINUTE
  )
}

export function getAbsentThresholdTime(date: Date): Date {
  return dateAtISTWallClock(
    getISTDateKey(date),
    ATTENDANCE_CONFIG.ABSENT_HOUR,
    ATTENDANCE_CONFIG.ABSENT_MINUTE
  )
}

/** Parse `HH:mm` on the IST calendar day of `referenceDate`. */
export function parseISTTimeOnDate(referenceDate: Date, timeHHmm: string): Date {
  const [hour, minute] = timeHHmm.split(':').map(Number)
  return dateAtISTWallClock(getISTDateKey(referenceDate), hour, minute)
}

/** Format check-in/out for UI (IST, 12-hour clock). */
export function formatAttendanceTime(time: string | Date | null | undefined): string {
  if (!time) return '-'
  return new Date(time).toLocaleTimeString('en-IN', {
    timeZone: ATTENDANCE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** `HH:mm` in IST for datetime-local / time inputs. */
export function formatAttendanceTimeInputValue(time: string | Date | null | undefined): string {
  if (!time) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ATTENDANCE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(time))
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

