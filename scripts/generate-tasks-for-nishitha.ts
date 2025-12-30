/**
 * Script to generate initial tasks for Dr Nishitha Mannem client
 * Account Manager: Gowthami
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { logActivity } from '../lib/activity-log'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('\n🔍 Finding client "Dr Nishitha Mannem"...\n')

    // Find the client
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { name: { contains: 'Nishitha', mode: 'insensitive' } },
          { doctorOrHospitalName: { contains: 'Nishitha', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        doctorOrHospitalName: true,
        accountManagerId: true,
      },
    })

    if (!client) {
      console.error('❌ Client "Dr Nishitha Mannem" not found')
      console.log('\n💡 Available clients:')
      const allClients = await prisma.client.findMany({
        select: { id: true, name: true, doctorOrHospitalName: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      })
      allClients.forEach(c => {
        console.log(`   - ${c.name} (${c.doctorOrHospitalName})`)
      })
      process.exit(1)
    }

    console.log(`✅ Found client: "${client.name}"`)
    console.log(`   Doctor/Hospital: "${client.doctorOrHospitalName}"`)
    console.log(`   Client ID: ${client.id}`)

    // Find Gowthami
    console.log('\n🔍 Finding Gowthami...\n')
    const gowthami = await prisma.user.findFirst({
      where: {
        name: { contains: 'Gowthami', mode: 'insensitive' },
        isActive: true,
      },
    })

    if (!gowthami) {
      console.error('❌ User "Gowthami" not found')
      process.exit(1)
    }

    console.log(`✅ Found Gowthami: ${gowthami.name} (ID: ${gowthami.id})`)

    // Check if client already has Gowthami as account manager
    if (client.accountManagerId !== gowthami.id) {
      console.log('\n📝 Updating account manager to Gowthami...')
      await prisma.client.update({
        where: { id: client.id },
        data: { accountManagerId: gowthami.id },
      })
      console.log('✅ Account manager updated')
    } else {
      console.log('\n✅ Client already has Gowthami as account manager')
    }

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

    if (existingTasks.length > 0) {
      console.log(`\n⚠️  ${existingTasks.length} initial task(s) already exist for this client:`)
      existingTasks.forEach(task => {
        console.log(`   - ${task.title}`)
      })
      console.log('\n💡 If you want to regenerate, please delete existing tasks first.')
      process.exit(0)
    }

    // Find all team members
    console.log('\n🔍 Finding team members...\n')
    const [shaheena, raghu, chaithanya] = await Promise.all([
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
        assignedById: gowthami.id,
        assignedToId: gowthami.id,
        clientId: client.id,
        startDate,
      })
      console.log(`✅ Created task: GMB optimisation (assigned to Gowthami)`)
    }

    // Content Calendar for Shaheena
    if (shaheena) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Content Calendar for ${client.name}`,
        description: `Content Calendar task for ${client.doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById: gowthami.id,
        assignedToId: shaheena.id,
        clientId: client.id,
        startDate,
      })
      console.log(`✅ Created task: Content Calendar (assigned to Shaheena)`)
    } else {
      console.log(`⚠️  Shaheena not found - skipping Content Calendar task`)
    }

    // Website content for Shaheena
    if (shaheena) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Website content for ${client.name}`,
        description: `Website content task for ${client.doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById: gowthami.id,
        assignedToId: shaheena.id,
        clientId: client.id,
        startDate,
      })
      console.log(`✅ Created task: Website content (assigned to Shaheena)`)
    } else {
      console.log(`⚠️  Shaheena not found - skipping Website content task`)
    }

    // Web development to Raghu
    if (raghu) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Web development for ${client.name}`,
        description: `Web development task for ${client.doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById: gowthami.id,
        assignedToId: raghu.id,
        clientId: client.id,
        startDate,
      })
      console.log(`✅ Created task: Web development (assigned to Raghu)`)
    } else {
      console.log(`⚠️  Raghu not found - skipping Web development task`)
    }

    // Poster design to Chaithanya
    if (chaithanya) {
      tasksToCreate.push({
        id: randomUUID(),
        title: `Poster design for ${client.name}`,
        description: `Poster design task for ${client.doctorOrHospitalName}`,
        priority: 'Medium' as const,
        status: 'Pending' as const,
        assignedById: gowthami.id,
        assignedToId: chaithanya.id,
        clientId: client.id,
        startDate,
      })
      console.log(`✅ Created task: Poster design (assigned to Chaithanya)`)
    } else {
      console.log(`⚠️  Chaithanya not found - skipping Poster design task`)
    }

    // Create all tasks
    if (tasksToCreate.length > 0) {
      console.log(`\n📝 Creating ${tasksToCreate.length} task(s)...\n`)
      await prisma.task.createMany({
        data: tasksToCreate,
      })

      // Log activity for each task
      for (const task of tasksToCreate) {
        await logActivity(gowthami.id, 'CREATE', 'Task', task.id)
      }

      console.log(`\n✅ Successfully created ${tasksToCreate.length} task(s) for "${client.name}"!`)
      console.log(`\n📋 Created tasks:`)
      tasksToCreate.forEach(task => {
        const assignee = task.assignedToId === gowthami.id ? 'Gowthami' :
                        task.assignedToId === shaheena?.id ? 'Shaheena' :
                        task.assignedToId === raghu?.id ? 'Raghu' :
                        task.assignedToId === chaithanya?.id ? 'Chaithanya' : 'Unknown'
        console.log(`   - ${task.title} → ${assignee}`)
      })
    } else {
      console.log('\n⚠️  No tasks were created (team members not found)')
    }

    console.log('\n✅ Done!\n')
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}\n`)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

