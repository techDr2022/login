export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { upsertCurrentMonthEmployeeSalary } from '@/app/actions/employee-salary-actions'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    const amount = Number(body?.amount)
    if (!userId) {
      return NextResponse.json({ error: 'Employee is required.' }, { status: 400 })
    }

    const saved = await upsertCurrentMonthEmployeeSalary(userId, amount)
    return NextResponse.json(saved)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save salary.'
    const status = message === 'Unauthorized' ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
