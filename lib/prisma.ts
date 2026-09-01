import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// Drop stale dev singleton after schema changes (HMR keeps an old PrismaClient without new models)
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  const client = globalForPrisma.prisma as PrismaClient & {
    clientRequest?: unknown
    attendance_holidays?: unknown
  }
  if (
    typeof client.clientRequest === 'undefined' ||
    typeof client.attendance_holidays === 'undefined'
  ) {
    void client.$disconnect().catch(() => {})
    globalForPrisma.prisma = undefined
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

