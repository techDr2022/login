import { prisma } from './prisma'

export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string
) {
  try {
    await prisma.activityLog.create({
      data: {
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

