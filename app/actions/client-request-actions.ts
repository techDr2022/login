'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ClientRequestStatus,
  ClientRequestType,
  Prisma,
} from '@prisma/client'
import { revalidatePath } from 'next/cache'

export type ClientRequestListItem = {
  id: string
  source: string
  clientId: string | null
  clientName: string | null
  contactPhone: string | null
  requestType: ClientRequestType
  summary: string
  notes: string | null
  status: ClientRequestStatus
  receivedAt: Date
  createdById: string
  createdAt: Date
  updatedAt: Date
  Client: { id: string; name: string; doctorOrHospitalName: string } | null
  createdBy: { id: string; name: string }
  assignees: { user: { id: string; name: string } }[]
}

async function requireSessionUserId() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id?.trim()) {
    throw new Error('Unauthorized')
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isActive: true },
  })
  if (!user?.isActive) {
    throw new Error('User not found or inactive')
  }
  return session.user.id
}

async function validateAssigneeIds(userIds: string[]) {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return []
  const users = await prisma.user.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { id: true },
  })
  if (users.length !== unique.length) {
    throw new Error('One or more assignees not found or inactive')
  }
  return unique
}

export async function getClientRequests(): Promise<ClientRequestListItem[]> {
  await requireSessionUserId()

  const rows = await prisma.clientRequest.findMany({
    orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      Client: {
        select: { id: true, name: true, doctorOrHospitalName: true },
      },
      createdBy: { select: { id: true, name: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return rows
}

export async function createClientRequest(data: {
  clientId?: string | null
  clientName?: string | null
  contactPhone?: string | null
  requestType: ClientRequestType
  summary: string
  notes?: string | null
  receivedAt?: Date
  createdById?: string | null
  assigneeIds?: string[] | null
}) {
  const userId = await requireSessionUserId()

  const summary = data.summary?.trim()
  if (!summary) {
    throw new Error('Summary is required')
  }

  const createdById = data.createdById?.trim() || userId

  if (data.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true },
    })
    if (!client) {
      throw new Error('Client not found')
    }
  }

  const creator = await prisma.user.findUnique({
    where: { id: createdById },
    select: { id: true, isActive: true },
  })
  if (!creator?.isActive) {
    throw new Error('Assigned by user not found or inactive')
  }

  const assigneeIds = await validateAssigneeIds(data.assigneeIds ?? [])

  const row = await prisma.clientRequest.create({
    data: {
      source: 'whatsapp',
      clientId: data.clientId || null,
      clientName: data.clientName?.trim() || null,
      contactPhone: data.contactPhone?.trim() || null,
      requestType: data.requestType,
      summary,
      notes: data.notes?.trim() || null,
      receivedAt: data.receivedAt ?? new Date(),
      createdById,
      assignees: {
        create: assigneeIds.map((uid) => ({ userId: uid })),
      },
    },
  })

  revalidatePath('/client-requests')
  return row
}

export async function updateClientRequest(
  id: string,
  data: {
    clientId?: string | null
    clientName?: string | null
    contactPhone?: string | null
    requestType?: ClientRequestType
    summary?: string
    notes?: string | null
    status?: ClientRequestStatus
    receivedAt?: Date
    createdById?: string | null
    assigneeIds?: string[] | null
  }
) {
  await requireSessionUserId()

  if (data.clientId !== undefined && data.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true },
    })
    if (!client) {
      throw new Error('Client not found')
    }
  }

  if (data.createdById !== undefined) {
    if (!data.createdById?.trim()) {
      throw new Error('Assigned by is required')
    }
    const creator = await prisma.user.findUnique({
      where: { id: data.createdById },
      select: { id: true, isActive: true },
    })
    if (!creator?.isActive) {
      throw new Error('Assigned by user not found or inactive')
    }
  }

  let assigneeCreates: { userId: string }[] | undefined
  if (data.assigneeIds !== undefined) {
    const ids = await validateAssigneeIds(data.assigneeIds ?? [])
    assigneeCreates = ids.map((userId) => ({ userId }))
  }

  const patch: Prisma.ClientRequestUncheckedUpdateInput = {}
  if (data.clientId !== undefined) {
    patch.clientId = data.clientId
  }
  if (data.clientName !== undefined) {
    patch.clientName = data.clientName?.trim() || null
  }
  if (data.contactPhone !== undefined) {
    patch.contactPhone = data.contactPhone?.trim() || null
  }
  if (data.requestType !== undefined) {
    patch.requestType = data.requestType
  }
  if (data.summary !== undefined) {
    const s = data.summary.trim()
    if (!s) throw new Error('Summary is required')
    patch.summary = s
  }
  if (data.notes !== undefined) {
    patch.notes = data.notes?.trim() || null
  }
  if (data.status !== undefined) {
    patch.status = data.status
  }
  if (data.receivedAt !== undefined) {
    patch.receivedAt = data.receivedAt
  }
  if (data.createdById !== undefined) {
    patch.createdById = data.createdById
  }

  await prisma.$transaction(async (tx) => {
    await tx.clientRequest.update({
      where: { id },
      data: patch,
    })

    if (assigneeCreates !== undefined) {
      await tx.clientRequestAssignee.deleteMany({ where: { clientRequestId: id } })
      if (assigneeCreates.length > 0) {
        await tx.clientRequestAssignee.createMany({
          data: assigneeCreates.map((a) => ({
            clientRequestId: id,
            userId: a.userId,
          })),
        })
      }
    }
  })

  revalidatePath('/client-requests')
}

export async function deleteClientRequest(id: string) {
  await requireSessionUserId()
  await prisma.clientRequest.delete({ where: { id } })
  revalidatePath('/client-requests')
}
