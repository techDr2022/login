'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'
import { canManageClients } from '@/lib/rbac'
import { UserRole, ClientStatus, Prisma } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/encryption'
import {
  clientOnboardingBasicSchema,
  clientDoctorSchema,
  clientServiceSchema,
  clientUSPSchema,
  clientAccessSchema,
  clientBrandingSchema,
  clientTargetingSchema,
  clientCompetitorSchema,
  clientMarketingRequirementSchema,
  clientApprovalSettingsSchema,
  clientKpiMonthlySchema,
  clientTaskSchema,
} from '@/lib/validations'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Helper to check authorization
async function checkAuth() {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  if (!canManageClients(session.user.role as UserRole)) {
    throw new Error('Forbidden')
  }
  return session
}

// ========== CLIENT BASIC INFO ==========
export async function updateClientBasicInfo(clientId: string, data: z.infer<typeof clientOnboardingBasicSchema>) {
  await checkAuth()
  const validated = clientOnboardingBasicSchema.parse(data)
  
  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      name: validated.name,
      type: validated.type,
      primaryContactName: validated.primaryContactName,
      phonePrimary: validated.phonePrimary,
      phoneWhatsApp: validated.phoneWhatsApp,
      email: validated.email || null,
      addressLine: validated.addressLine,
      area: validated.area,
      city: validated.city,
      pincode: validated.pincode,
      googleMapLink: validated.googleMapLink || null,
      workingDays: validated.workingDays ? validated.workingDays : Prisma.JsonNull,
      workingTimings: validated.workingTimings,
      preferredLanguage: validated.preferredLanguage,
    },
  })

  return client
}

export async function finalizeClientOnboarding(clientId: string, startDate: Date) {
  const session = await checkAuth()
  
  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      status: ClientStatus.ACTIVE,
      startDate,
      scopeFinalised: true,
      onboardingCompletedAt: new Date(),
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'Client', clientId)
  
  // Generate monthly tasks for the client
  await generateMonthlyTasksForClient(clientId, startDate)

  return client
}

// ========== DOCTORS ==========
export async function createClientDoctor(clientId: string, data: z.infer<typeof clientDoctorSchema>) {
  await checkAuth()
  const validated = clientDoctorSchema.parse(data)
  
  const doctor = await prisma.client_doctors.create({
    data: {
      id: randomUUID(),
      clientId,
      ...validated,
      languagesSpoken: validated.languagesSpoken ? validated.languagesSpoken : Prisma.JsonNull,
    },
  })

  return doctor
}

export async function updateClientDoctor(id: string, data: z.infer<typeof clientDoctorSchema>) {
  await checkAuth()
  const validated = clientDoctorSchema.parse(data)
  
  const doctor = await prisma.client_doctors.update({
    where: { id },
    data: {
      ...validated,
      languagesSpoken: validated.languagesSpoken ? validated.languagesSpoken : Prisma.JsonNull,
    },
  })

  return doctor
}

export async function deleteClientDoctor(id: string) {
  await checkAuth()
  await prisma.client_doctors.delete({
    where: { id },
  })
  return { success: true }
}

// ========== SERVICES ==========
export async function createClientService(clientId: string, data: z.infer<typeof clientServiceSchema>) {
  await checkAuth()
  const validated = clientServiceSchema.parse(data)
  
  const service = await prisma.client_services.create({
    data: {
      id: randomUUID(),
      clientId,
      ...validated,
    },
  })

  return service
}

export async function updateClientService(id: string, data: z.infer<typeof clientServiceSchema>) {
  await checkAuth()
  const validated = clientServiceSchema.parse(data)
  
  const service = await prisma.client_services.update({
    where: { id },
    data: validated,
  })

  return service
}

export async function deleteClientService(id: string) {
  await checkAuth()
  await prisma.client_services.delete({
    where: { id },
  })
  return { success: true }
}

// ========== USPs ==========
export async function createClientUSP(clientId: string, data: z.infer<typeof clientUSPSchema>) {
  await checkAuth()
  const validated = clientUSPSchema.parse(data)
  
  const usp = await prisma.client_usps.create({
    data: {
      id: randomUUID(),
      clientId,
      ...validated,
    },
  })

  return usp
}

export async function updateClientUSP(id: string, data: z.infer<typeof clientUSPSchema>) {
  await checkAuth()
  const validated = clientUSPSchema.parse(data)
  
  const usp = await prisma.client_usps.update({
    where: { id },
    data: validated,
  })

  return usp
}

export async function deleteClientUSP(id: string) {
  await checkAuth()
  await prisma.client_usps.delete({
    where: { id },
  })
  return { success: true }
}

// ========== ACCESS (with encryption) ==========
export async function createClientAccess(clientId: string, data: z.infer<typeof clientAccessSchema>) {
  const session = await checkAuth()
  const validated = clientAccessSchema.parse(data)
  
  const access = await prisma.client_accesses.create({
    data: {
      id: randomUUID(),
      clientId,
      type: validated.type,
      loginUrl: validated.loginUrl || null,
      username: validated.username || null,
      passwordEncrypted: validated.password ? encrypt(validated.password) : null,
      notes: validated.notes || null,
    },
  })

  await logActivity(session.user.id, 'CREATE', 'ClientAccess', access.id)
  return access
}

export async function updateClientAccess(id: string, data: z.infer<typeof clientAccessSchema>) {
  const session = await checkAuth()
  const validated = clientAccessSchema.parse(data)
  
  const access = await prisma.client_accesses.update({
    where: { id },
    data: {
      type: validated.type,
      loginUrl: validated.loginUrl || null,
      username: validated.username || null,
      passwordEncrypted: validated.password ? encrypt(validated.password) : null,
      notes: validated.notes || null,
    },
  })

  await logActivity(session.user.id, 'UPDATE', 'ClientAccess', id)
  return access
}

export async function deleteClientAccess(id: string) {
  const session = await checkAuth()
  await prisma.client_accesses.delete({
    where: { id },
  })
  await logActivity(session.user.id, 'DELETE', 'ClientAccess', id)
  return { success: true }
}

// Helper to decrypt password (only for Admin/Manager)
export async function getClientAccessWithPassword(id: string) {
  const session = await checkAuth()
  const access = await prisma.client_accesses.findUnique({
    where: { id },
  })

  if (!access) return null

  return {
    ...access,
    password: access.passwordEncrypted ? decrypt(access.passwordEncrypted) : null,
  }
}

// ========== BRANDING ==========
export async function upsertClientBranding(clientId: string, data: z.infer<typeof clientBrandingSchema>) {
  await checkAuth()
  const validated = clientBrandingSchema.parse(data)
  
  const branding = await prisma.client_branding.upsert({
    where: { clientId },
    create: {
      id: randomUUID(),
      clientId,
      brandColors: validated.brandColors ? validated.brandColors : Prisma.JsonNull,
      designerName: validated.designerName || null,
      templateBaseCreated: validated.templateBaseCreated,
      updatedAt: new Date(),
    },
    update: {
      brandColors: validated.brandColors ? validated.brandColors : Prisma.JsonNull,
      designerName: validated.designerName || null,
      templateBaseCreated: validated.templateBaseCreated,
    },
  })

  return branding
}

// ========== TARGETING ==========
export async function upsertClientTargeting(clientId: string, data: z.infer<typeof clientTargetingSchema>) {
  await checkAuth()
  const validated = clientTargetingSchema.parse(data)
  
  const targeting = await prisma.client_targeting.upsert({
    where: { clientId },
    create: {
      id: randomUUID(),
      clientId,
      primaryLocation: validated.primaryLocation || null,
      nearbyAreas: validated.nearbyAreas ? validated.nearbyAreas : Prisma.JsonNull,
      mainKeywords: validated.mainKeywords ? validated.mainKeywords : Prisma.JsonNull,
      exampleKeywords: validated.exampleKeywords ? validated.exampleKeywords : Prisma.JsonNull,
      updatedAt: new Date(),
    },
    update: {
      primaryLocation: validated.primaryLocation || null,
      nearbyAreas: validated.nearbyAreas ? validated.nearbyAreas : Prisma.JsonNull,
      mainKeywords: validated.mainKeywords ? validated.mainKeywords : Prisma.JsonNull,
      exampleKeywords: validated.exampleKeywords ? validated.exampleKeywords : Prisma.JsonNull,
    },
  })

  return targeting
}

// ========== COMPETITORS ==========
export async function createClientCompetitor(clientId: string, data: z.infer<typeof clientCompetitorSchema>) {
  await checkAuth()
  const validated = clientCompetitorSchema.parse(data)
  
  const competitor = await prisma.client_competitors.create({
    data: {
      id: randomUUID(),
      clientId,
      ...validated,
      googleMapLink: validated.googleMapLink || null,
    },
  })

  return competitor
}

export async function updateClientCompetitor(id: string, data: z.infer<typeof clientCompetitorSchema>) {
  await checkAuth()
  const validated = clientCompetitorSchema.parse(data)
  
  const competitor = await prisma.client_competitors.update({
    where: { id },
    data: {
      ...validated,
      googleMapLink: validated.googleMapLink || null,
    },
  })

  return competitor
}

export async function deleteClientCompetitor(id: string) {
  await checkAuth()
  await prisma.client_competitors.delete({
    where: { id },
  })
  return { success: true }
}

// ========== MARKETING REQUIREMENTS ==========
export async function upsertClientMarketingRequirement(
  clientId: string,
  data: z.infer<typeof clientMarketingRequirementSchema>
) {
  await checkAuth()
  const validated = clientMarketingRequirementSchema.parse(data)
  
  const requirement = await prisma.client_marketing_requirements.upsert({
    where: { clientId },
    create: {
      id: randomUUID(),
      clientId,
      ...validated,
      updatedAt: new Date(),
    },
    update: validated,
  })

  return requirement
}

// ========== APPROVAL SETTINGS ==========
export async function upsertClientApprovalSettings(
  clientId: string,
  data: z.infer<typeof clientApprovalSettingsSchema>
) {
  await checkAuth()
  const validated = clientApprovalSettingsSchema.parse(data)
  
  const settings = await prisma.client_approval_settings.upsert({
    where: { clientId },
    create: {
      id: randomUUID(),
      clientId,
      ...validated,
      updatedAt: new Date(),
    },
    update: {
      ...validated,
      updatedAt: new Date(),
    },
  })

  return settings
}

// ========== KPIs ==========
export async function upsertClientKpiMonthly(
  clientId: string,
  data: z.infer<typeof clientKpiMonthlySchema>
) {
  await checkAuth()
  const validated = clientKpiMonthlySchema.parse(data)
  
  const kpi = await prisma.client_kpi_monthly.upsert({
    where: {
      clientId_month: {
        clientId,
        month: validated.month,
      },
    },
    create: {
      id: randomUUID(),
      clientId,
      ...validated,
      updatedAt: new Date(),
    },
    update: {
      ...validated,
      updatedAt: new Date(),
    },
  })

  return kpi
}

// ========== CLIENT TASKS ==========
export async function createClientTask(clientId: string, data: z.infer<typeof clientTaskSchema>) {
  await checkAuth()
  const validated = clientTaskSchema.parse(data)
  
  const task = await prisma.client_tasks.create({
    data: {
      id: randomUUID(),
      clientId,
      ...validated,
      checklist: validated.checklist ? validated.checklist : Prisma.JsonNull,
      updatedAt: new Date(),
    },
  })

  return task
}

export async function updateClientTask(id: string, data: Partial<z.infer<typeof clientTaskSchema>>) {
  await checkAuth()
  
  const task = await prisma.client_tasks.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.status && { status: data.status }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
      ...(data.dueDate && { dueDate: data.dueDate }),
      ...(data.checklist !== undefined && { checklist: data.checklist ? data.checklist : Prisma.JsonNull }),
    },
  })

  return task
}

export async function deleteClientTask(id: string) {
  await checkAuth()
  await prisma.client_tasks.delete({
    where: { id },
  })
  return { success: true }
}

// ========== TASK TEMPLATE & GENERATION ==========
export async function getOrCreateMonthlyTaskTemplate() {
  await checkAuth()
  
  let template = await prisma.task_templates.findFirst({
    where: { isActive: true },
    include: { task_template_items: { orderBy: { order: 'asc' } } },
  })

  if (!template) {
    // Create default monthly template
    template = await prisma.task_templates.create({
      data: {
        id: randomUUID(),
        name: 'Monthly Fixed Template',
        isActive: true,
        updatedAt: new Date(),
        task_template_items: {
          create: [
            {
              id: randomUUID(),
              title: 'GMB Posts',
              description: 'Create and schedule Google My Business posts for the month',
              priority: 'Medium',
              order: 1,
            },
            {
              id: randomUUID(),
              title: '10 Social Posts',
              description: 'Create 10 social media posts for the month',
              priority: 'Medium',
              order: 2,
            },
            {
              id: randomUUID(),
              title: 'Reel',
              description: 'Create and publish a reel for the month',
              priority: 'Medium',
              order: 3,
            },
            {
              id: randomUUID(),
              title: 'Review Replies (Weekly once)',
              description: 'Reply to reviews weekly throughout the month',
              priority: 'High',
              order: 4,
              checklist: [
                { text: 'Week 1 Review Replies', completed: false },
                { text: 'Week 2 Review Replies', completed: false },
                { text: 'Week 3 Review Replies', completed: false },
                { text: 'Week 4 Review Replies', completed: false },
              ],
            },
            {
              id: randomUUID(),
              title: 'Keywords Tracking',
              description: 'Track and analyze keyword performance',
              priority: 'Medium',
              order: 5,
              checklist: [
                { text: 'Week 1 Keywords', completed: false },
                { text: 'Week 2 Keywords', completed: false },
                { text: 'Week 3 Keywords', completed: false },
                { text: 'Week 4 Keywords', completed: false },
              ],
            },
            {
              id: randomUUID(),
              title: 'Report – Month End',
              description: 'Generate and submit month-end performance report',
              priority: 'High',
              order: 6,
            },
          ],
        },
      },
      include: { task_template_items: { orderBy: { order: 'asc' } } },
    })
  }

  return template
}

export async function generateMonthlyTasksForClient(clientId: string, startDate: Date) {
  await checkAuth()
  
  const template = await getOrCreateMonthlyTaskTemplate()
  
  // Get current month and next month
  const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
  
  const months = [
    `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`,
    `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`,
  ]

  const tasks = []

  for (const month of months) {
    for (const item of template.task_template_items) {
      // Calculate due date (end of month by default, or based on offset)
      const [year, monthNum] = month.split('-').map(Number)
      const dueDate = new Date(year, monthNum - 1, item.dueDateOffset || 28)

      const task = await prisma.client_tasks.create({
        data: {
          id: randomUUID(),
          clientId,
          month,
          title: item.title,
          status: 'Pending',
          dueDate,
          checklist: item.checklist as any,
          createdFromTemplate: true,
          updatedAt: new Date(),
        },
      })

      tasks.push(task)
    }
  }

  return tasks
}

export async function generateTasksForMonth(clientId: string, month: string) {
  await checkAuth()
  
  // Check if tasks already exist for this month
  const existingTasks = await prisma.client_tasks.findMany({
    where: { clientId, month },
  })

  if (existingTasks.length > 0) {
    throw new Error('Tasks for this month already exist')
  }

  const template = await getOrCreateMonthlyTaskTemplate()
  
  const [year, monthNum] = month.split('-').map(Number)
  const tasks = []

  for (const item of template.task_template_items) {
    const dueDate = new Date(year, monthNum - 1, item.dueDateOffset || 28)

    const task = await prisma.client_tasks.create({
      data: {
        id: randomUUID(),
        clientId,
        month,
        title: item.title,
        status: 'Pending',
        dueDate,
        checklist: item.checklist as any,
        createdFromTemplate: true,
        updatedAt: new Date(),
      },
    })

    tasks.push(task)
  }

  return tasks
}

