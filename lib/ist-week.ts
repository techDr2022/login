import { getISTDateKey } from '@/lib/attendance-config'

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

export function istWeekday(date: Date): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(date)
  return WEEKDAY_INDEX[short] || 1
}

export function weekContaining(date: Date) {
  const key = getISTDateKey(date)
  const [year, month, day] = key.split('-').map(Number)
  const weekstart = new Date(Date.UTC(year, month - 1, day))
  weekstart.setUTCDate(weekstart.getUTCDate() - (istWeekday(date) - 1))
  const weekend = new Date(weekstart)
  weekend.setUTCDate(weekend.getUTCDate() + 6)
  return {
    weekstart,
    weekend,
    weekstartKey: weekstart.toISOString().slice(0, 10),
    weekendKey: weekend.toISOString().slice(0, 10),
  }
}

export function previousIstWeek(now = new Date()) {
  const current = weekContaining(now)
  const earlier = new Date(current.weekstart)
  earlier.setUTCDate(earlier.getUTCDate() - 3)
  return weekContaining(earlier)
}

export function weekFromMondayKey(mondayKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mondayKey)) {
    throw new Error('Week must be a YYYY-MM-DD Monday')
  }
  const start = new Date(`${mondayKey}T12:00:00.000+05:30`)
  const week = weekContaining(start)
  if (week.weekstartKey !== mondayKey) {
    throw new Error('Pick a Monday. Reports run Monday through Sunday, Asia/Kolkata.')
  }
  return week
}
