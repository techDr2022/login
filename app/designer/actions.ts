'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UserRole, ClientStatus } from '@prisma/client'
import { canAccessDesignerWorkspace } from '@/lib/rbac'
import { revalidatePath } from 'next/cache'

const monthKeySchema = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format, expected YYYY-MM')

const searchSchema = z.object({
  monthKey: monthKeySchema,
  search: z.string().optional(),
  sortBy: z.enum(['status', 'designed']).optional(),
})

export type MonthStatus = 'DELAY' | 'IN_PROGRESS' | 'READY'

export interface MonthRow {
  id: string
  clientId: string
  clientName: string
  targetCount: number
  designedCount: number
  approvedCount: number
  scheduledCount: number
  canvaFolderUrl?: string | null
  lastSharedAt?: Date | null
  approvalPendingSince?: Date | null
  status: MonthStatus
}

export interface MonthOverview {
  monthKey: string
  totalClients: number
  expected: number
  designed: number
  approved: number
  scheduled: number
  rows: MonthRow[]
}

async function requireDesignerSession() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    throw new Error('Unauthorized')
  }

  const role = session.user.role as UserRole
  if (!canAccessDesignerWorkspace(role)) {
    throw new Error('Forbidden')
  }

  return session
}

function computeStatus(row: {
  targetCount: number
  designedCount: number
  approvedCount: number
  scheduledCount: number
}): MonthStatus {
  const { targetCount, designedCount, approvedCount, scheduledCount } = row

  if (designedCount < targetCount) {
    return 'DELAY'
  }

  if (designedCount === targetCount && (approvedCount < targetCount || scheduledCount < targetCount)) {
    return 'IN_PROGRESS'
  }

  return 'READY'
}

export async function ensureMonthSeed(monthKey: string) {
  await requireDesignerSession()
  const parsedMonthKey = monthKeySchema.parse(monthKey)

  const activeClients = await prisma.client.findMany({
    where: { status: ClientStatus.ACTIVE },
    select: { id: true },
  })

  if (activeClients.length === 0) {
    return { created: 0 }
  }

  await prisma.monthlyProduction.createMany({
    data: activeClients.map((c) => ({
      clientId: c.id,
      monthKey: parsedMonthKey,
      targetCount: 10,
    })),
    skipDuplicates: true,
  })

  return { created: activeClients.length }
}

export async function getMonthOverview(input: {
  monthKey: string
  search?: string
  sortBy?: 'status' | 'designed'
}): Promise<MonthOverview> {
  await requireDesignerSession()
  const { monthKey, search, sortBy } = searchSchema.parse(input)

  await ensureMonthSeed(monthKey)

  const productions = await prisma.monthlyProduction.findMany({
    where: {
      monthKey,
      Client: {
        status: ClientStatus.ACTIVE,
        ...(search
          ? {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            }
          : {}),
      },
    },
    include: {
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  let rows: MonthRow[] = productions.map((p) => {
    const status = computeStatus(p)
    return {
      id: p.id,
      clientId: p.clientId,
      clientName: p.Client?.name ?? 'Unknown',
      targetCount: p.targetCount,
      designedCount: p.designedCount,
      approvedCount: p.approvedCount,
      scheduledCount: p.scheduledCount,
      canvaFolderUrl: p.canvaFolderUrl,
      lastSharedAt: p.lastSharedAt,
      approvalPendingSince: p.approvalPendingSince,
      status,
    }
  })

  if (sortBy === 'status') {
    const statusOrder: Record<MonthStatus, number> = {
      DELAY: 0,
      IN_PROGRESS: 1,
      READY: 2,
    }
    rows = rows.sort((a, b) => {
      const diff = statusOrder[a.status] - statusOrder[b.status]
      if (diff !== 0) return diff
      return a.clientName.localeCompare(b.clientName)
    })
  } else if (sortBy === 'designed') {
    rows = rows.sort((a, b) => {
      const aRatio = a.designedCount / (a.targetCount || 1)
      const bRatio = b.designedCount / (b.targetCount || 1)
      const diff = aRatio - bRatio
      if (diff !== 0) return diff
      return a.clientName.localeCompare(b.clientName)
    })
  } else {
    rows = rows.sort((a, b) => a.clientName.localeCompare(b.clientName))
  }

  const totalClients = rows.length
  const expected = rows.reduce((acc, r) => acc + r.targetCount, 0)
  const designed = rows.reduce((acc, r) => acc + r.designedCount, 0)
  const approved = rows.reduce((acc, r) => acc + r.approvedCount, 0)
  const scheduled = rows.reduce((acc, r) => acc + r.scheduledCount, 0)

  return {
    monthKey,
    totalClients,
    expected,
    designed,
    approved,
    scheduled,
    rows,
  }
}

const updateCountsSchema = z.object({
  id: z.string().cuid(),
  designedCount: z.number().int().min(0),
  approvedCount: z.number().int().min(0),
  scheduledCount: z.number().int().min(0),
})

export async function updateMonthlyCounts(data: {
  id: string
  designedCount: number
  approvedCount: number
  scheduledCount: number
}) {
  await requireDesignerSession()
  const parsed = updateCountsSchema.parse(data)

  const existing = await prisma.monthlyProduction.findUnique({
    where: { id: parsed.id },
    select: { targetCount: true },
  })

  if (!existing) {
    throw new Error('Monthly production not found')
  }

  const max = existing.targetCount
  if (
    parsed.designedCount > max ||
    parsed.approvedCount > max ||
    parsed.scheduledCount > max
  ) {
    throw new Error('Counts cannot exceed target')
  }

  const updated = await prisma.monthlyProduction.update({
    where: { id: parsed.id },
    data: {
      designedCount: parsed.designedCount,
      approvedCount: parsed.approvedCount,
      scheduledCount: parsed.scheduledCount,
    },
  })

  revalidatePath('/designer')
  return updated
}

const markMonthSchema = z.object({
  id: z.string().cuid(),
  field: z.enum(['designed', 'approved', 'scheduled']),
})

export async function markMonthComplete(input: { id: string; field: 'designed' | 'approved' | 'scheduled' }) {
  await requireDesignerSession()
  const parsed = markMonthSchema.parse(input)

  const existing = await prisma.monthlyProduction.findUnique({
    where: { id: parsed.id },
    select: { targetCount: true },
  })

  if (!existing) {
    throw new Error('Monthly production not found')
  }

  const data: any = {}
  if (parsed.field === 'designed') data.designedCount = existing.targetCount
  if (parsed.field === 'approved') data.approvedCount = existing.targetCount
  if (parsed.field === 'scheduled') data.scheduledCount = existing.targetCount

  const updated = await prisma.monthlyProduction.update({
    where: { id: parsed.id },
    data,
  })

  revalidatePath('/designer')
  return updated
}

const updateMetaSchema = z.object({
  id: z.string().cuid(),
  canvaFolderUrl: z.string().url().optional().or(z.literal('')).nullable(),
})

export async function updateCanvaFolder(input: { id: string; canvaFolderUrl?: string | null }) {
  await requireDesignerSession()
  const parsed = updateMetaSchema.parse(input)

  const updated = await prisma.monthlyProduction.update({
    where: { id: parsed.id },
    data: {
      canvaFolderUrl: parsed.canvaFolderUrl || null,
      lastSharedAt: new Date(),
    },
  })

  revalidatePath('/designer')
  return updated
}

const approvalSentSchema = z.object({
  id: z.string().cuid(),
})

export async function markApprovalSent(input: { id: string }) {
  await requireDesignerSession()
  const parsed = approvalSentSchema.parse(input)

  const updated = await prisma.monthlyProduction.update({
    where: { id: parsed.id },
    data: {
      approvalPendingSince: new Date(),
    },
  })

  revalidatePath('/designer')
  return updated
}

export async function getApprovals(input: { monthKey: string }): Promise<MonthRow[]> {
  await requireDesignerSession()
  const monthKey = monthKeySchema.parse(input.monthKey)

  await ensureMonthSeed(monthKey)

  const rows = await prisma.monthlyProduction.findMany({
    where: {
      monthKey,
      Client: {
        status: ClientStatus.ACTIVE,
      },
    },
    include: {
      Client: { select: { id: true, name: true } },
    },
  })

  const filtered = rows.filter(
    (p) => p.designedCount >= p.targetCount && p.approvedCount < p.targetCount
  )

  return filtered.map((p) => ({
    id: p.id,
    clientId: p.clientId,
    clientName: p.Client?.name ?? 'Unknown',
    targetCount: p.targetCount,
    designedCount: p.designedCount,
    approvedCount: p.approvedCount,
    scheduledCount: p.scheduledCount,
    canvaFolderUrl: p.canvaFolderUrl,
    lastSharedAt: p.lastSharedAt,
    approvalPendingSince: p.approvalPendingSince,
    status: computeStatus(p),
  }))
}

export async function getSchedulingQueue(input: { monthKey: string }): Promise<MonthRow[]> {
  await requireDesignerSession()
  const monthKey = monthKeySchema.parse(input.monthKey)

  await ensureMonthSeed(monthKey)

  const rows = await prisma.monthlyProduction.findMany({
    where: {
      monthKey,
      Client: {
        status: ClientStatus.ACTIVE,
      },
    },
    include: {
      Client: { select: { id: true, name: true } },
    },
  })

  const filtered = rows.filter(
    (p) => p.approvedCount >= p.targetCount && p.scheduledCount < p.targetCount
  )

  return filtered.map((p) => ({
    id: p.id,
    clientId: p.clientId,
    clientName: p.Client?.name ?? 'Unknown',
    targetCount: p.targetCount,
    designedCount: p.designedCount,
    approvedCount: p.approvedCount,
    scheduledCount: p.scheduledCount,
    canvaFolderUrl: p.canvaFolderUrl,
    lastSharedAt: p.lastSharedAt,
    approvalPendingSince: p.approvalPendingSince,
    status: computeStatus(p),
  }))
}

export async function getCanvaLinks(input: { monthKey: string }): Promise<MonthRow[]> {
  await requireDesignerSession()
  const monthKey = monthKeySchema.parse(input.monthKey)

  await ensureMonthSeed(monthKey)

  const rows = await prisma.monthlyProduction.findMany({
    where: {
      monthKey,
      Client: {
        status: ClientStatus.ACTIVE,
      },
    },
    include: {
      Client: { select: { id: true, name: true } },
    },
  })

  return rows.map((p) => ({
    id: p.id,
    clientId: p.clientId,
    clientName: p.Client?.name ?? 'Unknown',
    targetCount: p.targetCount,
    designedCount: p.designedCount,
    approvedCount: p.approvedCount,
    scheduledCount: p.scheduledCount,
    canvaFolderUrl: p.canvaFolderUrl,
    lastSharedAt: p.lastSharedAt,
    approvalPendingSince: p.approvalPendingSince,
    status: computeStatus(p),
  }))
}

