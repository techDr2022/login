import { NextRequest, NextResponse } from 'next/server'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { getISTDateKey } from '@/lib/attendance-config'
import { istDateKey } from '@/lib/engine/rules'
import { runEscalation, runReminders, runScheduler } from '@/lib/engine/run'

export const dynamic = 'force-dynamic'

function istMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const now = new Date()
  const minutes = istMinutes(now)
  const result: Record<string, unknown> = { date: getISTDateKey(now), ist: istDateKey(now.getTime()) }
  try {
    if (minutes >= 9 * 60 + 20 && minutes < 10 * 60) result.schedule = await runScheduler(now)
    if (minutes >= 10 * 60 && minutes < 10 * 60 + 25) result.reminders = await runReminders(now)
    result.escalation = await runEscalation(now)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Work engine]', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
