function loadEnv() {
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const file = path.join(process.cwd(), '.env.local')
  if (!process.env.DATABASE_URL && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)="(.*)"$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  }
}

loadEnv()

async function main() {
  const { prisma } = await import('../lib/prisma')
  const rows = await prisma.task.groupBy({
    by: ['status'],
    where: { templateid: { not: null } },
    _count: true,
  })
  console.log(rows)
  const gowthami = await prisma.user.findFirst({ where: { name: 'Gowthami' }, select: { id: true } })
  const start = new Date('2026-10-26T00:00:00+05:30')
  const end = new Date('2026-10-26T23:59:59+05:30')
  const today = await prisma.task.count({
    where: { assignedToId: gowthami?.id, templateid: { not: null }, dueDate: { gte: start, lte: end } },
  })
  console.log('gowthami today', today)
  const token = await prisma.appsetting.findUnique({ where: { id: 'PUBLIC_BOARD_TOKEN' } })
  console.log('TOKEN', token?.value)
  await prisma.$disconnect()
}

main()
