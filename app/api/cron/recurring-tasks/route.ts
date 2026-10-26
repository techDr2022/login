import { NextRequest, NextResponse } from 'next/server'
import { isCronRequestAuthorized } from '@/lib/cron-auth'
import { runDueRecurrence } from '@/lib/automation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runDueRecurrence()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Recurring tasks]', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
