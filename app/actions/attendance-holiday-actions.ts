'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { getISTDayStart, getISTDateKey } from '@/lib/attendance-config'
import { invalidateAttendanceHolidayCache } from '@/lib/attendance-holidays'
import {
  ensureAttendanceHolidaysTable,
  findAttendanceHolidayByDateKey,
  insertAttendanceHoliday,
  deleteAttendanceHolidayById,
  listAttendanceHolidayRows,
  seedDefaultAttendanceHolidaysIfEmpty,
  toAttendanceHolidayDateKey,
} from '@/lib/attendance-holiday-db'
import { formatDateLocal, parseDateLocal } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

export interface AttendanceHolidayItem {
  id: string
  date: string
  name: string | null
  createdAt: string
}

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Unauthorized')
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admin can manage holidays')
  }
  return session
}

export async function listAttendanceHolidays(): Promise<AttendanceHolidayItem[]> {
  await requireSuperAdmin()
  await ensureAttendanceHolidaysTable()
  await seedDefaultAttendanceHolidaysIfEmpty()

  const rows = await listAttendanceHolidayRows()

  return rows.map((row) => ({
    id: row.id,
    date: getISTDateKey(row.date),
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function addAttendanceHoliday(input: {
  date: string
  name?: string
}): Promise<AttendanceHolidayItem> {
  const session = await requireSuperAdmin()
  await ensureAttendanceHolidaysTable()

  const dayStart = getISTDayStart(parseDateLocal(input.date))
  const dateKey = toAttendanceHolidayDateKey(input.date)
  const trimmedName = input.name?.trim() || null

  const existing = await findAttendanceHolidayByDateKey(dateKey)
  if (existing) {
    throw new Error('A holiday already exists on this date')
  }

  try {
    const created = await insertAttendanceHoliday({
      date: dayStart,
      name: trimmedName,
      createdBy: session.user.id,
    })

    invalidateAttendanceHolidayCache()
    revalidatePath('/attendance')

    return {
      id: created.id,
      date: formatDateLocal(created.date),
      name: created.name,
      createdAt: created.createdAt.toISOString(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('23505') || message.includes('already exists')) {
      throw new Error('A holiday already exists on this date')
    }
    throw error
  }
}

export async function removeAttendanceHoliday(id: string): Promise<void> {
  await requireSuperAdmin()
  await deleteAttendanceHolidayById(id)

  invalidateAttendanceHolidayCache()
  revalidatePath('/attendance')
}
