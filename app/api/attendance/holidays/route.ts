export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { getISTDateKey } from '@/lib/attendance-config'
import {
  ensureAttendanceHolidaysTable,
  listAttendanceHolidayRows,
  seedDefaultAttendanceHolidaysIfEmpty,
} from '@/lib/attendance-holiday-db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureAttendanceHolidaysTable()
    await seedDefaultAttendanceHolidaysIfEmpty()
    const rows = await listAttendanceHolidayRows()

    return NextResponse.json({
      holidays: rows.map((row) => ({
        id: row.id,
        date: getISTDateKey(row.date),
        name: row.name,
        createdAt: row.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Failed to list attendance holidays:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load holidays' },
      { status: 500 }
    )
  }
}
