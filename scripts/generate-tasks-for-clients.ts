/**
 * Script to generate initial tasks for existing clients that don't have them
 * 
 * Usage:
 *   npx tsx scripts/generate-tasks-for-clients.ts [clientId]
 * 
 * If clientId is provided, generates tasks for that specific client.
 * If no clientId is provided, generates tasks for all eligible clients.
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { logActivity } from '../lib/activity-log'

const prisma = new PrismaClient()

async function generateInitialTasksForClient(
  clientId: string,
  clientName: string,
  doctorOrHospitalName: string,
  assignedById: string
) {
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
            `Video content for ${clientName}`,
            `Web development for ${clientName}`,
            `Poster design for ${clientName}`,
          ],
        },
      },
    })

    // If any of the initial tasks already exist, skip generation
    if (existingTasks.length > 0) {
      console.log(`  ⚠️  Initial tasks already exist for client "${clientName}", skipping...`)
      return false
    }

    // Find users by name (case-insensitive)
    const [gowthami, shaheena, raghu, chaithanya, rohith] = await Promise.all([
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
      prisma.user.findFirst({
        where: {
          name: { contains: 'Rohith', mode: 'insensitive' },
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

    // Video content for Shaheena
    if (shaheena) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Video content for ${clientName}`,
        description: `Video content task for ${doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById,
        assignedToId: shaheena.id,
        clientId,
        startDate,
      })
    }

    // Web development to Raghu (will be auto-assigned when Website content is completed)
    if (raghu) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Web development for ${clientName}`,
        description: `Web development task for ${doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById,
        assignedToId: null, // Will be assigned when Website content is completed
        clientId,
        startDate,
      })
    }

    // Poster design to Chaithanya (will be auto-assigned when Content Calendar is completed)
    if (chaithanya) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Poster design for ${clientName}`,
        description: `Poster design task for ${doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById,
        assignedToId: null, // Will be assigned when Content Calendar is completed
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

      console.log(`  ✅ Generated ${tasksToCreate.length} tasks for "${clientName}"`)
      return true
    } else {
      console.log(`  ⚠️  No team members found to assign tasks for "${clientName}"`)
      return false
    }
  } catch (error) {
    console.error(`  ❌ Error generating tasks for "${clientName}":`, error)
    throw error
  }
}

async function main() {
  const clientId = process.argv[2]

  try {
    if (clientId) {
      // Generate tasks for a specific client
      console.log(`\n🔍 Finding client with ID: ${clientId}...`)
      
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
        console.error(`❌ Client with ID "${clientId}" not found`)
        process.exit(1)
      }

      if (!client.accountManagerId) {
        console.error(`❌ Client "${client.name}" does not have an account manager. Please assign one first.`)
        process.exit(1)
      }

      // Get the account manager as the assignedBy user
      const accountManager = await prisma.user.findUnique({
        where: { id: client.accountManagerId },
      })

      if (!accountManager) {
        console.error(`❌ Account manager not found`)
        process.exit(1)
      }

      console.log(`\n📋 Generating tasks for client: "${client.name}"`)
      await generateInitialTasksForClient(
        client.id,
        client.name,
        client.doctorOrHospitalName || client.name,
        accountManager.id
      )
      console.log(`\n✅ Done!\n`)
    } else {
      // Generate tasks for all eligible clients
      console.log(`\n🔍 Finding all clients with account managers...`)
      
      const clients = await prisma.client.findMany({
        where: {
          accountManagerId: { not: null },
        },
        select: {
          id: true,
          name: true,
          doctorOrHospitalName: true,
          accountManagerId: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (clients.length === 0) {
        console.log(`\n⚠️  No clients with account managers found.\n`)
        process.exit(0)
      }

      console.log(`\n📋 Found ${clients.length} client(s) with account managers`)
      console.log(`\nGenerating tasks...\n`)

      let successCount = 0
      let skippedCount = 0
      let errorCount = 0

      for (const client of clients) {
        try {
          const accountManager = await prisma.user.findUnique({
            where: { id: client.accountManagerId! },
          })

          if (!accountManager) {
            console.log(`  ⚠️  Account manager not found for "${client.name}", skipping...`)
            skippedCount++
            continue
          }

          const result = await generateInitialTasksForClient(
            client.id,
            client.name,
            client.doctorOrHospitalName || client.name,
            accountManager.id
          )

          if (result) {
            successCount++
          } else {
            skippedCount++
          }
        } catch (error: any) {
          errorCount++
          console.error(`  ❌ Error processing "${client.name}": ${error.message}`)
        }
      }

      console.log(`\n📊 Summary:`)
      console.log(`   ✅ Success: ${successCount}`)
      console.log(`   ⚠️  Skipped: ${skippedCount}`)
      console.log(`   ❌ Errors: ${errorCount}`)
      console.log(`\n✅ Done!\n`)
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}\n`)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

