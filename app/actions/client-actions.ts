'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createClientSchema, updateClientSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { canManageClients, canCreateClient, canEditClient } from '@/lib/rbac'
import { UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'

// Helper function to generate initial tasks for a client
export async function generateInitialTasksForClient(clientId: string, clientName: string, doctorOrHospitalName: string, assignedById: string) {
  try {
    // Check if initial tasks already exist for this client to prevent duplicates
    const existingTasks = await prisma.task.findMany({
      where: {
        clientId,
        title: {
          in: [
            `GMB optimisation for ${clientName}`,
            `Content Calendar for ${clientName}`,
            `Website content for ${clientName}`,
            `Web development for ${clientName}`,
            `Poster design for ${clientName}`,
          ],
        },
      },
    })

    // If any of the initial tasks already exist, skip generation
    if (existingTasks.length > 0) {
      console.log(`Initial tasks already exist for client ${clientId}, skipping generation`)
      return
    }

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
        title: `GMB optimisation for ${clientName}`,
        description: `GMB optimisation task for ${doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById,
        assignedToId: gowthami.id,
        clientId,
        startDate,
      })
    }

    // Content Calendar for Shaheena
    if (shaheena) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Content Calendar for ${clientName}`,
        description: `Content Calendar task for ${doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById,
        assignedToId: shaheena.id,
        clientId,
        startDate,
      })
    }

    // Website content for Shaheena
    if (shaheena) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Website content for ${clientName}`,
        description: `Website content task for ${doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById,
        assignedToId: shaheena.id,
        clientId,
        startDate,
      })
    }

    // Web development to Raghu
    if (raghu) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Web development for ${clientName}`,
        description: `Web development task for ${doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById,
        assignedToId: raghu.id,
        clientId,
        startDate,
      })
    }

    // Poster design to Chaithanya
    if (chaithanya) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Poster design for ${clientName}`,
        description: `Poster design task for ${doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById,
        assignedToId: chaithanya.id,
        clientId,
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
        await logActivity(assignedById, 'CREATE', 'Task', task.id)
      }
    }
  } catch (error) {
    // Log error but don't fail if task creation fails
    console.error('Error creating automatic tasks for client:', error)
    throw error // Re-throw so caller can handle it
  }
}

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
      await generateInitialTasksForClient(
        client.id,
        client.name,
        client.doctorOrHospitalName,
        session.user.id
      )
    } catch (error) {
      // Log error but don't fail client creation if task creation fails
      console.error('Error creating automatic tasks for client:', error)
    }
  }

  // Revalidate paths to refresh UI
  revalidatePath('/clients')
  revalidatePath('/dashboard')
  revalidatePath(`/clients/${client.id}`)

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

  if (!canEditClient(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  const validated = updateClientSchema.parse(data)
  
  const client = await prisma.client.update({
    where: { id },
    data: validated,
  })

  await logActivity(session.user.id, 'UPDATE', 'Client', client.id)

  // Revalidate paths to refresh UI
  revalidatePath('/clients')
  revalidatePath('/dashboard')
  revalidatePath(`/clients/${id}`)

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

  // Revalidate paths to refresh UI
  revalidatePath('/clients')
  revalidatePath('/dashboard')

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

  // Revalidate paths to refresh UI
  revalidatePath('/clients')
  revalidatePath('/dashboard')
  revalidatePath(`/clients/${id}`)

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

  // Revalidate paths to refresh UI
  revalidatePath('/clients')
  revalidatePath('/dashboard')

  return { success: true, count: result.count }
}

// Function to generate tasks for existing clients that don't have them
export async function generateTasksForExistingClient(clientId: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageClients(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  // Get the client
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      doctorOrHospitalName: true,
      accountManagerId: true,
    },
  })

  if (!client) {
    throw new Error('Client not found')
  }

  // Only generate tasks if client has an account manager
  if (!client.accountManagerId) {
    throw new Error('Client must have an account manager to generate tasks')
  }

  // Generate initial tasks
  await generateInitialTasksForClient(
    client.id,
    client.name,
    client.doctorOrHospitalName || client.name,
    session.user.id
  )

  // Revalidate paths to refresh UI
  revalidatePath('/clients')
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath(`/clients/${clientId}`)

  return { success: true, message: 'Tasks generated successfully' }
}

// Function to generate tasks for all clients that have account managers but no initial tasks
export async function generateTasksForAllEligibleClients() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (!canManageClients(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }

  // Find all clients with account managers
  const clients = await prisma.client.findMany({
    where: {
      accountManagerId: { not: null },
    },
    select: {
      id: true,
      name: true,
      doctorOrHospitalName: true,
    },
  })

  let successCount = 0
  let errorCount = 0
  const errors: string[] = []

  for (const client of clients) {
    try {
      // Check if tasks already exist
      const existingTasks = await prisma.task.findMany({
        where: {
          clientId: client.id,
          title: {
            in: [
              `GMB optimisation for ${client.name}`,
              `Content Calendar for ${client.name}`,
              `Website content for ${client.name}`,
              `Web development for ${client.name}`,
              `Poster design for ${client.name}`,
            ],
          },
        },
      })

      // Only generate if tasks don't exist
      if (existingTasks.length === 0) {
        await generateInitialTasksForClient(
          client.id,
          client.name,
          client.doctorOrHospitalName || client.name,
          session.user.id
        )
        successCount++
      }
    } catch (error: any) {
      errorCount++
      errors.push(`${client.name}: ${error.message}`)
    }
  }

  // Revalidate paths to refresh UI
  revalidatePath('/clients')
  revalidatePath('/tasks')
  revalidatePath('/dashboard')

  return {
    success: true,
    message: `Generated tasks for ${successCount} client(s). ${errorCount} error(s).`,
    successCount,
    errorCount,
    errors: errors.length > 0 ? errors : undefined,
  }
}

