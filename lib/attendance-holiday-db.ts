import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getISTDateKey, getISTDayStart } from '@/lib/attendance-config'
import { parseDateLocal } from '@/lib/utils'

/** Default company holidays (date + name). Synced into attendance_holidays on load. */
export const ATTENDANCE_DEFAULT_HOLIDAYS: Array<{ date: string; name: string }> = [
  { date: '2025-01-14', name: 'Public Holiday' },
  { date: '2025-01-26', name: 'Republic Day' },
  { date: '2025-03-04', name: 'Public Holiday' },
  { date: '2025-03-26', name: 'Public Holiday' },
  { date: '2025-03-30', name: 'Public Holiday' },
  { date: '2025-03-31', name: 'Public Holiday' },
  { date: '2025-06-07', name: 'Public Holiday' },
  { date: '2025-08-09', name: 'Ganesh Chaturthi' },
  { date: '2025-08-15', name: 'Independence Day' },
  { date: '2025-10-20', name: 'Public Holiday' },
  { date: '2025-11-08', name: 'Public Holiday' },
  { date: '2025-12-25', name: 'Christmas' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-08-28', name: 'Rakhi Festival' },
]

export const ATTENDANCE_PUBLIC_HOLIDAY_DATES: string[] = ATTENDANCE_DEFAULT_HOLIDAYS.map(
  (holiday) => holiday.date
)

export interface AttendanceHolidayRow {
  id: string
  date: Date
  name: string | null
  createdAt: Date
}

export async function ensureAttendanceHolidaysTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "attendance_holidays" (
      "id" TEXT NOT NULL,
      "date" DATE NOT NULL,
      "name" TEXT,
      "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attendance_holidays_pkey" PRIMARY KEY ("id")
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "attendance_holidays_date_key"
    ON "attendance_holidays"("date");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "attendance_holidays_date_idx"
    ON "attendance_holidays"("date");
  `)
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'attendance_holidays_createdBy_fkey'
      ) THEN
        ALTER TABLE "attendance_holidays"
        ADD CONSTRAINT "attendance_holidays_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `)
}

export async function listAttendanceHolidayRows(): Promise<AttendanceHolidayRow[]> {
  await ensureAttendanceHolidaysTable()
  return prisma.$queryRaw<AttendanceHolidayRow[]>`
    SELECT "id", "date", "name", "createdAt"
    FROM "attendance_holidays"
    ORDER BY "date" ASC
  `
}

export function toAttendanceHolidayDateKey(date: Date | string): string {
  if (typeof date === 'string') {
    return date.slice(0, 10)
  }
  return getISTDateKey(date)
}

export async function findAttendanceHolidayByDateKey(
  dateKey: string
): Promise<AttendanceHolidayRow | null> {
  await ensureAttendanceHolidaysTable()
  const rows = await prisma.$queryRaw<AttendanceHolidayRow[]>`
    SELECT "id", "date", "name", "createdAt"
    FROM "attendance_holidays"
    WHERE "date" = ${dateKey}::date
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function findAttendanceHolidayByDate(date: Date): Promise<AttendanceHolidayRow | null> {
  return findAttendanceHolidayByDateKey(toAttendanceHolidayDateKey(date))
}

export async function insertAttendanceHoliday(input: {
  date: Date
  name: string | null
  createdBy?: string | null
}): Promise<AttendanceHolidayRow> {
  await ensureAttendanceHolidaysTable()
  const id = randomUUID()
  const dateKey = toAttendanceHolidayDateKey(input.date)
  const rows = await prisma.$queryRaw<AttendanceHolidayRow[]>`
    INSERT INTO "attendance_holidays" ("id", "date", "name", "createdBy", "createdAt")
    VALUES (${id}, ${dateKey}::date, ${input.name}, ${input.createdBy ?? null}, CURRENT_TIMESTAMP)
    RETURNING "id", "date", "name", "createdAt"
  `
  return rows[0]
}

export async function deleteAttendanceHolidayById(id: string): Promise<void> {
  await ensureAttendanceHolidaysTable()
  await prisma.$executeRaw`
    DELETE FROM "attendance_holidays" WHERE "id" = ${id}
  `
}

export async function countAttendanceHolidays(): Promise<number> {
  await ensureAttendanceHolidaysTable()
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM "attendance_holidays"
  `
  return rows[0]?.count ?? 0
}

export async function upsertAttendanceHolidayByDateKey(input: {
  dateKey: string
  name: string
  createdBy?: string | null
}): Promise<void> {
  await ensureAttendanceHolidaysTable()
  const existing = await findAttendanceHolidayByDateKey(input.dateKey)
  if (existing) {
    if (existing.name !== input.name) {
      await prisma.$executeRaw`
        UPDATE "attendance_holidays"
        SET "name" = ${input.name}
        WHERE "id" = ${existing.id}
      `
    }
    return
  }

  await insertAttendanceHoliday({
    date: getISTDayStart(parseDateLocal(input.dateKey)),
    name: input.name,
    createdBy: input.createdBy ?? null,
  })
}

export async function syncDefaultAttendanceHolidays(): Promise<void> {
  await ensureAttendanceHolidaysTable()
  for (const holiday of ATTENDANCE_DEFAULT_HOLIDAYS) {
    await upsertAttendanceHolidayByDateKey({
      dateKey: holiday.date,
      name: holiday.name,
      createdBy: null,
    })
  }
}

export async function seedDefaultAttendanceHolidaysIfEmpty(): Promise<void> {
  const count = await countAttendanceHolidays()
  if (count > 0) return

  for (const holiday of ATTENDANCE_DEFAULT_HOLIDAYS) {
    await upsertAttendanceHolidayByDateKey({
      dateKey: holiday.date,
      name: holiday.name,
      createdBy: null,
    })
  }
}
