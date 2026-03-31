import { prisma } from './prisma'
import { randomUUID } from 'crypto'

export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  description?: string
) {
  try {
    await prisma.activity_logs.create({
      data: {
        id: randomUUID(),
        userId,
        action,
        entityType,
        entityId,
      },
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
    // Don't throw - activity logging should not break the main flow
  }
}

