'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createClientSchema, updateClientSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { canManageClients } from '@/lib/rbac'
import { UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'

export async function createClient(data: {
  name: string
  doctorOrHospitalName: string
  location: string
  services: string[]
  accountManagerId?: string
  type?: 'CLINIC' | 'HOSPITAL' | 'DOCTOR'
}) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageClients(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  // Ensure services array has at least one item for validation
  const clientData = {
    ...data,
    services: data.services && data.services.length > 0 ? data.services : ['Onboarding'],
  }
  
  const validated = createClientSchema.parse(clientData)
  
  const client = await prisma.client.create({
    data: {
      id: randomUUID(),
      name: validated.name,
      doctorOrHospitalName: validated.doctorOrHospitalName,
      location: validated.location,
      services: validated.services,
      ...(validated.accountManagerId && { accountManagerId: validated.accountManagerId }),
      type: data.type || 'CLINIC',
      status: 'ONBOARDING',
    },
  })

  await logActivity(session.user.id, 'CREATE', 'Client', client.id)

  return client
}

export async function updateClient(id: string, data: {
  name?: string
  doctorOrHospitalName?: string
  location?: string
  services?: string[]
  accountManagerId?: string
}) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageClients(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  const validated = updateClientSchema.parse(data)
  
  const client = await prisma.client.update({
    where: { id },
    data: validated,
  })

  await logActivity(session.user.id, 'UPDATE', 'Client', client.id)

  return client
}

export async function deleteClient(id: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageClients(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  await prisma.client.delete({
    where: { id },
  })

  await logActivity(session.user.id, 'DELETE', 'Client', id)

  return { success: true }
}

