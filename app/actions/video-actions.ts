'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { VIDEOS_PER_MONTH_TARGET } from '@/lib/videos-config'
import { UserRole } from '@prisma/client'

export interface ClientVideoRow {
  id: string
  clientId: string
  name: string
  doctorOrHospitalName: string
  monthKey: string
  rawCount: number
  editedCount: number
  postedCount: number
  targetCount: number
  lastShootDate: Date | null
  notes: string | null
  accountManager: { id: string; name: string } | null
}

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function getClientVideos(monthKey?: string): Promise<ClientVideoRow[]> {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can view videos dashboard')
  }

  const key = monthKey ?? getCurrentMonthKey()

  const clients = await prisma.client.findMany({
    where: {
      status: { in: ['ACTIVE', 'ONBOARDING'] },
    },
    select: {
      id: true,
      name: true,
      doctorOrHospitalName: true,
      User: { select: { id: true, name: true } },
      client_marketing_requirements: {
        select: {
          reelsPerMonth: true,
        },
      },
      clientVideoMonths: {
        where: { monthKey: key },
        take: 1,
        select: {
          rawCount: true,
          editedCount: true,
          postedCount: true,
          lastShootDate: true,
          notes: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return clients.map((client) => {
    const month = client.clientVideoMonths[0]
    const perClientTarget =
      client.client_marketing_requirements?.reelsPerMonth && client.client_marketing_requirements.reelsPerMonth > 0
        ? client.client_marketing_requirements.reelsPerMonth
        : VIDEOS_PER_MONTH_TARGET
    return {
      id: client.id,
      clientId: client.id,
      name: client.name,
      doctorOrHospitalName: client.doctorOrHospitalName,
      monthKey: key,
      rawCount: month?.rawCount ?? 0,
      editedCount: month?.editedCount ?? 0,
      postedCount: month?.postedCount ?? 0,
      targetCount: perClientTarget,
      lastShootDate: month?.lastShootDate ?? null,
      notes: month?.notes ?? null,
      accountManager: client.User
        ? { id: client.User.id, name: client.User.name }
        : null,
    }
  })
}

export async function updateClientVideoMonth(
  clientId: string,
  monthKey: string,
  data: {
    rawCount?: number
    editedCount?: number
    postedCount?: number
    lastShootDate?: Date | null
    notes?: string | null
  }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new Error('Unauthorized')
  }

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Only super admins can update video stats')
  }

  await prisma.clientVideoMonth.upsert({
    where: {
      clientId_monthKey: { clientId, monthKey },
    },
    create: {
      clientId,
      monthKey,
      rawCount: data.rawCount ?? 0,
      editedCount: data.editedCount ?? 0,
      postedCount: data.postedCount ?? 0,
      lastShootDate: data.lastShootDate ?? undefined,
      notes: data.notes ?? undefined,
    },
    update: {
      ...(data.rawCount !== undefined && { rawCount: data.rawCount }),
      ...(data.editedCount !== undefined && { editedCount: data.editedCount }),
      ...(data.postedCount !== undefined && { postedCount: data.postedCount }),
      ...(data.lastShootDate !== undefined && { lastShootDate: data.lastShootDate }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  })
}
