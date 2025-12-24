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
  
  // WFH Activity Tracking
  WFH_ACTIVITY_PING_INTERVAL_MINUTES: 60, // Ping every 60 minutes
  WFH_INACTIVITY_THRESHOLD_MINUTES: 120, // Flag if no activity for 2+ hours
  
  // Minimum working hours for WFH to be considered Present
  WFH_MIN_HOURS_FOR_PRESENT: 8.5,
  
  // Employment Types
  EMPLOYMENT_TYPES: {
    OFFICE: 'Office',
    WFH: 'WFH',
    HYBRID: 'Hybrid',
  } as const,
} as const

export function getOfficeStartTime(date: Date): Date {
  const start = new Date(date)
  start.setHours(ATTENDANCE_CONFIG.OFFICE_START_HOUR, ATTENDANCE_CONFIG.OFFICE_START_MINUTE, 0, 0)
  return start
}

export function getOfficeEndTime(date: Date): Date {
  const end = new Date(date)
  end.setHours(ATTENDANCE_CONFIG.OFFICE_END_HOUR, ATTENDANCE_CONFIG.OFFICE_END_MINUTE, 0, 0)
  return end
}

export function getLunchStartTime(date: Date): Date {
  const lunch = new Date(date)
  lunch.setHours(ATTENDANCE_CONFIG.LUNCH_START_HOUR, ATTENDANCE_CONFIG.LUNCH_START_MINUTE, 0, 0)
  return lunch
}

export function getLunchEndTime(date: Date): Date {
  const lunch = new Date(date)
  lunch.setHours(ATTENDANCE_CONFIG.LUNCH_END_HOUR, ATTENDANCE_CONFIG.LUNCH_END_MINUTE, 0, 0)
  return lunch
}

export function isLate(checkInTime: Date, officeStartTime: Date): boolean {
  const diffMinutes = Math.round((checkInTime.getTime() - officeStartTime.getTime()) / (1000 * 60))
  return diffMinutes > ATTENDANCE_CONFIG.LATE_THRESHOLD_MINUTES
}

