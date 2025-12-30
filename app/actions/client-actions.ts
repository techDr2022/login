'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createClientSchema, updateClientSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { canManageClients, canCreateClient } from '@/lib/rbac'
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

  if (!canCreateClient(session.user.role as UserRole)) {
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

  // Automatically create tasks when client has an account manager
  if (validated.accountManagerId) {
    try {
      // Find users by name (case-insensitive)
      const [gowthami, shaheena, raghu, chaithanya] = await Promise.all([
        prisma.user.findFirst({
          where: {
            name: { contains: 'Gowthami', mode: 'insensitive' },
            isActive: true,
          },
        }),
        prisma.user.findFirst({
          where: {
            name: { contains: 'Shaheena', mode: 'insensitive' },
            isActive: true,
          },
        }),
        prisma.user.findFirst({
          where: {
            name: { contains: 'Raghu', mode: 'insensitive' },
            isActive: true,
          },
        }),
        prisma.user.findFirst({
          where: {
            name: { contains: 'Chaithanya', mode: 'insensitive' },
            isActive: true,
          },
        }),
      ])

      const startDate = new Date()
      const tasksToCreate = []

      // GMB optimisation for Gowthami
      if (gowthami) {
        tasksToCreate.push({
          id: randomUUID(),
          title: `GMB optimisation for ${client.name}`,
          description: `GMB optimisation task for ${client.doctorOrHospitalName}`,
          priority: 'Medium' as const,
          status: 'Pending' as const,
          assignedById: session.user.id,
          assignedToId: gowthami.id,
          clientId: client.id,
          startDate,
        })
      }

      // Content Calendar for Shaheena
      if (shaheena) {
        tasksToCreate.push({
          id: randomUUID(),
          title: `Content Calendar for ${client.name}`,
          description: `Content Calendar task for ${client.doctorOrHospitalName}`,
          priority: 'Medium' as const,
          status: 'Pending' as const,
          assignedById: session.user.id,
          assignedToId: shaheena.id,
          clientId: client.id,
          startDate,
        })
      }

      // Website content for Shaheena
      if (shaheena) {
        tasksToCreate.push({
          id: randomUUID(),
          title: `Website content for ${client.name}`,
          description: `Website content task for ${client.doctorOrHospitalName}`,
          priority: 'Medium' as const,
          status: 'Pending' as const,
          assignedById: session.user.id,
          assignedToId: shaheena.id,
          clientId: client.id,
          startDate,
        })
      }

      // Web development to Raghu
      if (raghu) {
        tasksToCreate.push({
          id: randomUUID(),
          title: `Web development for ${client.name}`,
          description: `Web development task for ${client.doctorOrHospitalName}`,
          priority: 'Medium' as const,
          status: 'Pending' as const,
          assignedById: session.user.id,
          assignedToId: raghu.id,
          clientId: client.id,
          startDate,
        })
      }

      // Poster design to Chaithanya
      if (chaithanya) {
        tasksToCreate.push({
          id: randomUUID(),
          title: `Poster design for ${client.name}`,
          description: `Poster design task for ${client.doctorOrHospitalName}`,
          priority: 'Medium' as const,
          status: 'Pending' as const,
          assignedById: session.user.id,
          assignedToId: chaithanya.id,
          clientId: client.id,
          startDate,
        })
      }

      // Create all tasks in a transaction
      if (tasksToCreate.length > 0) {
        await prisma.task.createMany({
          data: tasksToCreate,
        })

        // Log activity for each task
        for (const task of tasksToCreate) {
          await logActivity(session.user.id, 'CREATE', 'Task', task.id)
        }
      }
    } catch (error) {
      // Log error but don't fail client creation if task creation fails
      console.error('Error creating automatic tasks for client:', error)
    }
  }

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

export async function updateClientStatus(id: string, status: 'ONBOARDING' | 'ACTIVE' | 'PAUSED') {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageClients(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  const client = await prisma.client.update({
    where: { id },
    data: { status },
  })

  await logActivity(session.user.id, 'UPDATE', 'Client', id)

  return client
}

export async function bulkUpdateClientStatus(ids: string[], status: 'ONBOARDING' | 'ACTIVE' | 'PAUSED') {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageClients(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  if (!ids || ids.length === 0) {
    throw new Error('No clients selected')
  }

  const result = await prisma.client.updateMany({
    where: {
      id: { in: ids },
    },
    data: { status },
  })

  // Log activity for each updated client
  for (const id of ids) {
    await logActivity(session.user.id, 'UPDATE', 'Client', id)
  }

  return { success: true, count: result.count }
}

