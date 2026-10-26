import { getISTDateKey } from '@/lib/attendance-config'

export function clientTaskLabel(status: string, dueDate: Date | string | null): string {
  if (status === 'Approved' || status === 'Done') return 'Finished'
  if (status === 'WaitingOnInput') return 'Waiting on you'
  if (!dueDate) return 'Under progress'
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return 'Under progress'

  const todayKey = getISTDateKey(new Date())
  const dueKey = getISTDateKey(due)
  const days = Math.round(
    (new Date(`${dueKey}T00:00:00.000Z`).getTime() - new Date(`${todayKey}T00:00:00.000Z`).getTime()) /
      86400000
  )
  if (days > 1) return `Under progress · finishes in ${days} days`
  if (days === 1) return 'Under progress · finishes in 1 day'
  if (days === 0) return 'Under progress · finishes today'
  const late = Math.abs(days)
  return late === 1 ? 'Under progress · overdue by 1 day' : `Under progress · overdue by ${late} days`
}
