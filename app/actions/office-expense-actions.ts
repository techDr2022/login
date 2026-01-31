'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export interface OfficeExpenseItem {
  id: string
  name: string
  amount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export async function getOfficeExpenses(): Promise<OfficeExpenseItem[]> {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can view office expenses')
  }

  const expenses = await prisma.officeExpense.findMany({
    orderBy: { name: 'asc' },
  })

  return expenses
}

export async function createOfficeExpense(data: { name: string; amount: number }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can add office expenses')
  }

  const expense = await prisma.officeExpense.create({
    data: {
      name: data.name.trim(),
      amount: Number(data.amount),
      isActive: true,
    },
  })

  return expense
}

export async function updateOfficeExpense(
  id: string,
  data: { name?: string; amount?: number; isActive?: boolean }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can update office expenses')
  }

  const updateData: { name?: string; amount?: number; isActive?: boolean } = {}
  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.amount !== undefined) updateData.amount = Number(data.amount)
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  await prisma.officeExpense.update({
    where: { id },
    data: updateData,
  })
}

export async function deleteOfficeExpense(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can delete office expenses')
  }

  await prisma.officeExpense.delete({
    where: { id },
  })
}
