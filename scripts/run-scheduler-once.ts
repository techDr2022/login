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
  const { runScheduler } = await import('../lib/engine/run')
  const shaheena = await prisma.user.findFirst({ where: { name: 'Shaheena' }, select: { id: true } })
  const members = await prisma.user.findMany({
    where: { teamid: { not: null }, role: 'EMPLOYEE', isActive: true },
    select: { name: true, escalatestouserid: true },
  })
  const pointed = members.filter((member) => member.escalatestouserid === shaheena?.id).map((member) => member.name)
  console.log('members pointing at Shaheena', pointed.sort().join(', '))
  const result = await runScheduler(new Date())
  console.log(result)
  const tasks = await prisma.task.count({ where: { templateid: { not: null } } })
  console.log('engine tasks', tasks)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
