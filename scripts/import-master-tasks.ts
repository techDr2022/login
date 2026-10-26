import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
function loadEnv() {
  const file = path.join(process.cwd(), '.env.local')
  if (!process.env.DATABASE_URL && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)="(.*)"$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
    }
  }
}

loadEnv()

const TIME_BLOCK_EXCEPTIONS = new Set(['MKT-DS7', 'RAG-D7', 'DV-D6'])

type SeedPerson = { name: string; team: string; role: string; escalates_to: string }
type SeedTemplate = {
  id: string
  title: string
  team: string
  default_assignees: string[]
  section: string
  trigger_type: string
  starts_when: string
  repeat: string
  time_or_day: string
  depends_on: { ids: string[]; mode: string }
  waiting_on_cross_team: { ids: string[]; mode: string }
  input_from: string
  input_needed: string
  hand_off_to: string
  done_when: string
  priority: string
  per_client: boolean
  needs_confirmation: boolean
  source: string
  notes: string
}

function slug(value: string) {
  return value.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function firstName(value: string) {
  return value.trim().toLowerCase().split(/\s+/)[0] || ''
}

function distance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index])
  for (let column = 1; column <= right.length; column += 1) rows[0][column] = column
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
    }
  }
  return rows[left.length][right.length]
}

function roleFor(role: string) {
  if (role === 'Admin') return 'SUPER_ADMIN'
  if (role === 'Coordinator') return 'COORDINATOR'
  return 'EMPLOYEE'
}

function findCycle(ids: string[], edges: Array<[string, string]>) {
  const next = new Map<string, string[]>()
  for (const id of ids) next.set(id, [])
  for (const [from, to] of edges) next.get(from)?.push(to)
  const color = new Map<string, number>()
  const stack: string[] = []
  function walk(id: string): string[] | null {
    color.set(id, 1)
    stack.push(id)
    for (const child of next.get(id) ?? []) {
      if (color.get(child) === 1) return stack.slice(stack.indexOf(child))
      if (!color.get(child)) {
        const found = walk(child)
        if (found) return found
      }
    }
    stack.pop()
    color.set(id, 2)
    return null
  }
  for (const id of ids) {
    if (!color.get(id)) {
      const found = walk(id)
      if (found) return found
    }
  }
  return null
}

async function main() {
  const { prisma } = await import('../lib/prisma')
  const seedPath = path.join(process.cwd(), 'data', 'master_tasks.json')
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as {
    teams: string[]
    people: SeedPerson[]
    task_templates: SeedTemplate[]
  }
  const edges: Array<[string, string]> = []
  for (const template of seed.task_templates) {
    for (const id of template.depends_on?.ids ?? []) edges.push([template.id, id])
    for (const id of template.waiting_on_cross_team?.ids ?? []) edges.push([template.id, id])
  }
  const cycle = findCycle(seed.task_templates.map((template) => template.id), edges)
  if (cycle) {
    console.error('Dependency cycle:', cycle.join(' -> '))
    process.exit(1)
  }

  const users = await prisma.user.findMany({
    where: { isActive: true, role: { not: 'CLIENT' } },
    select: { id: true, name: true },
  })
  const matched = new Map<string, { id: string; name: string }>()
  for (const person of seed.people) {
    const wanted = firstName(person.name)
    const exact = users.find((user) => firstName(user.name) === wanted || user.name.trim().toLowerCase() === person.name.trim().toLowerCase())
    if (exact) {
      matched.set(person.name, exact)
      continue
    }
    const close = users.filter((user) => distance(firstName(user.name), wanted) === 1)
    if (close.length === 1) {
      matched.set(person.name, close[0])
      console.log(`Matched ${person.name} -> ${close[0].name}`)
      continue
    }
    console.error(close.length ? `Ambiguous match for ${person.name}` : `No user matched ${person.name}`)
    process.exit(1)
  }

  const teamIds = new Map<string, string>()
  for (const name of seed.teams) {
    const id = slug(name)
    await prisma.team.upsert({
      where: { id },
      update: { name },
      create: { id, name },
    })
    teamIds.set(name, id)
  }

  let peopleUpdated = 0
  for (const person of seed.people) {
    const user = matched.get(person.name)
    if (!user) continue
    const escalates = person.escalates_to
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
    const contact = escalates.length === 1 ? matched.get(escalates[0]) : undefined
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: roleFor(person.role) as 'SUPER_ADMIN' | 'COORDINATOR' | 'EMPLOYEE',
        teamid: teamIds.get(person.team) ?? null,
        escalatestouserid: contact?.id ?? null,
      },
    })
    peopleUpdated += 1
  }

  let templates = 0
  let dependencies = 0
  for (const template of seed.task_templates) {
    const data = {
      title: template.title,
      teamid: teamIds.get(template.team) ?? null,
      section: template.section || null,
      triggertype: template.trigger_type,
      startswhen: template.starts_when || null,
      repeat: template.repeat || null,
      timeorday: template.time_or_day || null,
      inputfrom: template.input_from || null,
      inputneeded: template.input_needed || null,
      handoffto: template.hand_off_to || null,
      donewhen: template.done_when || null,
      priority: template.priority || 'Medium',
      perclient: !!template.per_client,
      istimelock: template.section === 'Daily Schedule' && !TIME_BLOCK_EXCEPTIONS.has(template.id),
      needsconfirmation: !!template.needs_confirmation,
      source: template.source || null,
      notes: template.notes || null,
      active: true,
    }
    await prisma.worktemplate.upsert({
      where: { id: template.id },
      update: data,
      create: { id: template.id, ...data },
    })
    templates += 1
    await prisma.worktemplateassignee.deleteMany({ where: { templateid: template.id } })
    const assigneeRows = []
    for (const name of template.default_assignees) {
      const user = matched.get(name)
      if (!user) {
        console.error(`No assignee match for ${name} on ${template.id}`)
        process.exit(1)
      }
      assigneeRows.push({ id: randomUUID(), templateid: template.id, userid: user.id })
    }
    if (assigneeRows.length) await prisma.worktemplateassignee.createMany({ data: assigneeRows })
  }

  for (const template of seed.task_templates) {
    await prisma.templatedependency.deleteMany({ where: { templateid: template.id } })
    const deps = [
      ...(template.depends_on?.ids ?? []).map((id) => ({ id, kind: 'same-team', mode: template.depends_on?.mode === 'any' ? 'any' : 'all' })),
      ...(template.waiting_on_cross_team?.ids ?? []).map((id) => ({
        id,
        kind: 'cross-team',
        mode: template.waiting_on_cross_team?.mode === 'any' ? 'any' : 'all',
      })),
    ]
    if (!deps.length) continue
    await prisma.templatedependency.createMany({
      data: deps.map((dep) => ({
        id: randomUUID(),
        templateid: template.id,
        dependsonid: dep.id,
        kind: dep.kind,
        mode: dep.mode,
      })),
    })
    dependencies += deps.length
  }

  console.log(`people ${peopleUpdated}`)
  console.log(`teams ${seed.teams.length}`)
  console.log(`templates ${templates}`)
  console.log(`dependencies ${dependencies}`)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
