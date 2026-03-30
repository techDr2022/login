'use server'

import { getServerSession } from 'next-auth'
import { UserRole } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isInvoicesUnlockedForUser } from '@/lib/invoices-unlock'

export interface ActiveEmployee {
  id: string
  name: string
  email: string
}

export interface EmployeeSalaryItem {
  id: string
  userId: string
  monthKey: string
  amount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

async function requireSuperAdminAndUnlock(): Promise<void> {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can manage employee salary')
  }
  if (!session.user.id) throw new Error('Unauthorized')
  const unlocked = await isInvoicesUnlockedForUser(session.user.id)
  if (!unlocked) throw new Error('Unlock the Invoices tab first (password or OTP).')
}

async function ensureEmployeeSalaryTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmployeeSalary" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "monthKey" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
    );
  `)

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalary_userId_monthKey_key"
    ON "EmployeeSalary"("userId", "monthKey");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EmployeeSalary_monthKey_idx"
    ON "EmployeeSalary"("monthKey");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EmployeeSalary_isActive_idx"
    ON "EmployeeSalary"("isActive");
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EmployeeSalary_userId_idx"
    ON "EmployeeSalary"("userId");
  `)

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'EmployeeSalary_userId_fkey'
      ) THEN
        ALTER TABLE "EmployeeSalary"
        ADD CONSTRAINT "EmployeeSalary_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `)
}

export async function getActiveEmployees(): Promise<ActiveEmployee[]> {
  await requireSuperAdminAndUnlock()
  const users = await prisma.user.findMany({
    where: {
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: 'asc' },
  })
  return users
}

export async function getCurrentMonthSalaries(): Promise<EmployeeSalaryItem[]> {
  await requireSuperAdminAndUnlock()
  await ensureEmployeeSalaryTable()

  const monthKey = getCurrentMonthKey()
  const salaries = await prisma.employeeSalary.findMany({
    where: { monthKey },
    orderBy: { createdAt: 'asc' },
  })
  return salaries
}

export async function upsertCurrentMonthEmployeeSalary(userId: string, amount: number): Promise<EmployeeSalaryItem> {
  await requireSuperAdminAndUnlock()
  await ensureEmployeeSalaryTable()

  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error('Salary amount must be a non-negative number')
  }

  const monthKey = getCurrentMonthKey()
  const salary = await prisma.employeeSalary.upsert({
    where: {
      userId_monthKey: { userId, monthKey },
    },
    create: {
      userId,
      monthKey,
      amount: numericAmount,
      isActive: true,
    },
    update: {
      amount: numericAmount,
      isActive: true,
    },
  })
  return salary
}
