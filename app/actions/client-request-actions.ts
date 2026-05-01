'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ClientRequestStatus,
  ClientRequestType,
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
  assignedToId: string | null
  createdAt: Date
  updatedAt: Date
  Client: { id: string; name: string; doctorOrHospitalName: string } | null
  createdBy: { id: string; name: string }
  assignedTo: { id: string; name: string } | null
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

export async function getClientRequests(): Promise<ClientRequestListItem[]> {
  await requireSessionUserId()

  const rows = await prisma.clientRequest.findMany({
    orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      Client: {
        select: { id: true, name: true, doctorOrHospitalName: true },
      },
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
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
  assignedToId?: string | null
}) {
  const userId = await requireSessionUserId()

  const summary = data.summary?.trim()
  if (!summary) {
    throw new Error('Summary is required')
  }

  if (data.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true },
    })
    if (!client) {
      throw new Error('Client not found')
    }
  }

  if (data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.assignedToId },
      select: { id: true, isActive: true },
    })
    if (!assignee?.isActive) {
      throw new Error('Assignee not found or inactive')
    }
  }

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
      createdById: userId,
      assignedToId: data.assignedToId || null,
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
    assignedToId?: string | null
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

  if (data.assignedToId !== undefined && data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.assignedToId },
      select: { id: true, isActive: true },
    })
    if (!assignee?.isActive) {
      throw new Error('Assignee not found or inactive')
    }
  }

  await prisma.clientRequest.update({
    where: { id },
    data: {
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.clientName !== undefined && {
        clientName: data.clientName?.trim() || null,
      }),
      ...(data.contactPhone !== undefined && {
        contactPhone: data.contactPhone?.trim() || null,
      }),
      ...(data.requestType !== undefined && { requestType: data.requestType }),
      ...(data.summary !== undefined && {
        summary: (() => {
          const s = data.summary!.trim()
          if (!s) throw new Error('Summary is required')
          return s
        })(),
      }),
      ...(data.notes !== undefined && {
        notes: data.notes?.trim() || null,
      }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.receivedAt !== undefined && { receivedAt: data.receivedAt }),
      ...(data.assignedToId !== undefined && {
        assignedToId: data.assignedToId,
      }),
    },
  })

  revalidatePath('/client-requests')
}

export async function deleteClientRequest(id: string) {
  await requireSessionUserId()
  await prisma.clientRequest.delete({ where: { id } })
  revalidatePath('/client-requests')
}
