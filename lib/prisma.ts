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

// HMR keeps the first PrismaClient on globalThis. After prisma generate, that
// instance still has the old schema and rejects new fields and unique keys.
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  const client = globalForPrisma.prisma as PrismaClient & {
    clientRequest?: unknown
    attendance_holidays?: unknown
    clientweeklyreport?: unknown
    notification?: unknown
  }
  if (
    !(client instanceof PrismaClient) ||
    typeof client.clientRequest === 'undefined' ||
    typeof client.attendance_holidays === 'undefined' ||
    typeof client.clientweeklyreport === 'undefined' ||
    typeof client.notification === 'undefined'
  ) {
    void client.$disconnect().catch(() => {})
    globalForPrisma.prisma = undefined
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

