import { prisma } from './prisma'
import { randomUUID } from 'crypto'

export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  description?: string,
  change?: { oldvalue?: string | null; newvalue?: string | null }
) {
  try {
    await prisma.activity_logs.create({
      data: {
        id: randomUUID(),
        userId,
        action,
        entityType,
        entityId,
        oldvalue: change?.oldvalue ?? null,
        newvalue: change?.newvalue ?? description ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
    // Don't throw - activity logging should not break the main flow
  }
}

