export const TIME_BLOCK_EXCEPTIONS = new Set(['MKT-DS7', 'RAG-D7', 'DV-D6'])
export const DAY_START_MIN = 10 * 60
export const DAY_END_MIN = 18 * 60 + 30

export type RepeatKind = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'manual'
export type DepMode = 'all' | 'any'
export type Actor = 'assignee' | 'coordinator' | 'admin' | 'system'

export type DepLink = {
  dependsonid: string
  kind: string
  mode: DepMode
}

export type ScopeInstance = {
  templateid: string
  status: string
  dueat: number
  clientid: string | null
  projectid: string | null
  periodkey: string
  assigneeid?: string | null
}

export type TemplatePlan = {
  id: string
  repeat: string
  timeorday: string | null
  section: string | null
  triggertype: string
  perclient: boolean
  assigneeIds: string[]
}

export type PlannedInstance = {
  templateid: string
  periodkey: string
  dueKey: string
  clientid: string | null
  assigneeid: string | null
  slot: string
  enginekey: string
}

const WEEKDAYS: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

export const STATUS_LABEL: Record<string, string> = {
  Locked: 'Locked',
  ToDo: 'To Do',
  InProgress: 'In Progress',
  WaitingOnInput: 'Waiting on Input',
  InReview: 'In Review',
  Done: 'Done',
  Cancelled: 'Cancelled',
  Pending: 'Pending',
  Review: 'Review',
  Approved: 'Approved',
  Rejected: 'Rejected',
}

export function weekdayOfKey(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

export function shiftKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function isWorkingDay(key: string, holidays: ReadonlySet<string>): boolean {
  const weekday = weekdayOfKey(key)
  return weekday >= 1 && weekday <= 6 && !holidays.has(key)
}

export function addWorkingDays(key: string, delta: number, holidays: ReadonlySet<string>): string {
  let left = Math.abs(delta)
  const sign = delta < 0 ? -1 : 1
  let cursor = key
  while (left > 0) {
    cursor = shiftKey(cursor, sign)
    if (isWorkingDay(cursor, holidays)) left -= 1
  }
  return cursor
}

export function weekKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

export function clampDay(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clamped = Math.min(Math.max(day, 1), last)
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

export function repeatKind(repeat: string): RepeatKind {
  const value = repeat.toLowerCase()
  if (value.startsWith('daily')) return 'daily'
  if (value.startsWith('weekly')) return 'weekly'
  if (value.startsWith('monthly')) return 'monthly'
  if (value.startsWith('quarterly')) return 'quarterly'
  return 'manual'
}

export function isSchedulerTemplate(template: { triggertype: string; repeat: string }): boolean {
  if (template.triggertype === 'On Event') return false
  return repeatKind(template.repeat) !== 'manual'
}

export function isTimeBlockTemplate(template: { id: string; section: string | null }): boolean {
  return template.section === 'Daily Schedule' && !TIME_BLOCK_EXCEPTIONS.has(template.id)
}

export function weekdayFromText(texts: Array<string | null | undefined>): number | null {
  const blob = texts.filter(Boolean).join(' ').toLowerCase()
  for (const [name, number] of Object.entries(WEEKDAYS)) {
    if (blob.includes(name)) return number
  }
  return null
}

export function monthDayFromText(text: string | null | undefined): number | null {
  if (!text) return null
  const match = text.match(/(\d{1,2})(?:st|nd|rd|th)/i)
  if (!match) return null
  const day = Number(match[1])
  return day >= 1 && day <= 31 ? day : null
}

function parseClock(raw: string, inherited: 'am' | 'pm' | null): number | null {
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const meridian = (match[3]?.toLowerCase() as 'am' | 'pm' | undefined) || inherited
  if (!meridian || hour > 23 || minute > 59) return null
  if (meridian === 'pm' && hour < 12) hour += 12
  if (meridian === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}

export function dueClock(text: string | null | undefined): { start: number; due: number } {
  const fallback = { start: DAY_START_MIN, due: DAY_END_MIN }
  if (!text || !/am|pm/i.test(text)) return fallback
  if (text.includes('/')) {
    const parts = text
      .split('/')
      .map((part) => parseClock(part.trim(), null))
      .filter((value): value is number => value != null)
    if (!parts.length) return fallback
    return { start: parts[0], due: parts[parts.length - 1] }
  }
  const bits = text.split(/\u2013|-/).map((part) => part.trim()).filter(Boolean)
  if (bits.length === 1) {
    const only = parseClock(bits[0], null)
    return only == null ? fallback : { start: only, due: only }
  }
  const right = bits[bits.length - 1]
  const inherited = /pm/i.test(right) ? 'pm' : /am/i.test(right) ? 'am' : null
  const start = parseClock(bits[0], /am|pm/i.test(bits[0]) ? null : inherited)
  const due = parseClock(right, null)
  if (start == null || due == null) return fallback
  return { start, due }
}

export function datesToCheck(todayKey: string, holidays: ReadonlySet<string>): string[] {
  if (!isWorkingDay(todayKey, holidays)) return []
  const dates = [todayKey]
  let cursor = todayKey
  for (let index = 0; index < 3; index += 1) {
    cursor = addWorkingDays(cursor, -1, holidays)
    dates.push(cursor)
  }
  return dates
}

function weekMonday(dateKey: string): string {
  return shiftKey(dateKey, -(weekdayOfKey(dateKey) - 1))
}

function firstWorkingOnOrAfter(key: string, holidays: ReadonlySet<string>): string | null {
  let cursor = key
  for (let index = 0; index < 7; index += 1) {
    if (isWorkingDay(cursor, holidays)) return cursor
    cursor = shiftKey(cursor, 1)
  }
  return null
}

function creationForDate(
  template: TemplatePlan,
  dateKey: string,
  todayKey: string,
  holidays: ReadonlySet<string>
): { periodkey: string; dueKey: string } | null {
  const kind = repeatKind(template.repeat)
  if (kind === 'manual' || template.triggertype === 'On Event') return null
  if (!isWorkingDay(dateKey, holidays)) return null

  if (kind === 'daily') {
    if (isTimeBlockTemplate(template) && dateKey !== todayKey) return null
    return { periodkey: dateKey, dueKey: dateKey }
  }

  if (kind === 'weekly') {
    const weekday = weekdayFromText([template.repeat, template.timeorday])
    const monday = weekMonday(dateKey)
    const target = weekday == null ? firstWorkingOnOrAfter(monday, holidays) : firstWorkingOnOrAfter(shiftKey(monday, weekday - 1), holidays)
    if (target !== dateKey) return null
    return { periodkey: weekKey(monday), dueKey: dateKey }
  }

  if (kind === 'monthly' || kind === 'quarterly') {
    const [year, month] = dateKey.split('-').map(Number)
    const months: Array<[number, number]> = []
    for (const delta of [-1, 0, 1]) {
      let nextYear = year
      let nextMonth = month + delta
      if (nextMonth < 1) {
        nextMonth = 12
        nextYear -= 1
      }
      if (nextMonth > 12) {
        nextMonth = 1
        nextYear += 1
      }
      months.push([nextYear, nextMonth])
    }
    const day = monthDayFromText(template.timeorday) ?? 1
    for (const [dueYear, dueMonth] of months) {
      if (kind === 'quarterly' && ![1, 4, 7, 10].includes(dueMonth)) continue
      if (kind === 'quarterly' && monthDayFromText(template.timeorday) == null && day !== 1) continue
      const dueKey = clampDay(dueYear, dueMonth, kind === 'quarterly' ? (monthDayFromText(template.timeorday) ?? 1) : day)
      const createdOn = addWorkingDays(dueKey, -3, holidays)
      if (createdOn !== dateKey) continue
      const periodkey = kind === 'quarterly'
        ? `${dueYear}-Q${Math.floor((dueMonth - 1) / 3) + 1}`
        : `${dueYear}-${String(dueMonth).padStart(2, '0')}`
      return { periodkey, dueKey }
    }
  }
  return null
}

function slotsFor(
  template: TemplatePlan,
  ownerid: string | null
): Array<{ assigneeid: string | null; slot: string }> {
  const ids = template.assigneeIds
  if (template.section === 'Daily Schedule') {
    return ids.map((id) => ({ assigneeid: id, slot: id }))
  }
  if (template.perclient && ownerid && ids.includes(ownerid)) {
    return [{ assigneeid: ownerid, slot: ownerid }]
  }
  if (ids.length === 1) return [{ assigneeid: ids[0], slot: ids[0] }]
  return [{ assigneeid: null, slot: 'team' }]
}

export function engineKey(templateid: string, clientid: string | null, periodkey: string, slot: string): string {
  return `${templateid}|${clientid ?? ''}|${periodkey}|${slot}`
}

export function planInstances(input: {
  templates: TemplatePlan[]
  clients: Array<{ id: string; ownerid: string | null }>
  todayKey: string
  holidays: ReadonlySet<string>
}): PlannedInstance[] {
  const dates = datesToCheck(input.todayKey, input.holidays)
  const planned: PlannedInstance[] = []
  const seen = new Set<string>()
  for (const template of input.templates) {
    if (!isSchedulerTemplate(template)) continue
    for (const dateKey of dates) {
      const created = creationForDate(template, dateKey, input.todayKey, input.holidays)
      if (!created) continue
      const clientRows = template.perclient ? input.clients : [{ id: '', ownerid: null }]
      for (const client of clientRows) {
        const clientid = template.perclient ? client.id : null
        for (const slot of slotsFor(template, client.ownerid)) {
          const key = engineKey(template.id, clientid, created.periodkey, slot.slot)
          if (seen.has(key)) continue
          seen.add(key)
          planned.push({
            templateid: template.id,
            periodkey: created.periodkey,
            dueKey: created.dueKey,
            clientid,
            assigneeid: slot.assigneeid,
            slot: slot.slot,
            enginekey: key,
          })
        }
      }
    }
  }
  return planned
}

export function inScope(
  dependency: ScopeInstance,
  task: { clientid: string | null; projectid: string | null; periodkey: string; dueat: number }
): boolean {
  if (dependency.dueat > task.dueat) return false
  if (task.projectid && dependency.projectid) {
    if (task.projectid === dependency.projectid) return true
    return !!task.clientid && task.clientid === dependency.clientid
  }
  if ((task.clientid || dependency.clientid) && task.clientid !== dependency.clientid) return false
  return dependency.periodkey === task.periodkey
}

function latest(instances: ScopeInstance[]): ScopeInstance | null {
  return instances.reduce<ScopeInstance | null>((best, item) => {
    if (!best || item.dueat >= best.dueat) return item
    return best
  }, null)
}

export function linksSatisfied(
  links: DepLink[],
  pool: ScopeInstance[],
  task: { clientid: string | null; projectid: string | null; periodkey: string; dueat: number }
): { satisfied: boolean; missing: boolean } {
  if (!links.length) return { satisfied: true, missing: false }
  const groups = new Map<DepMode, DepLink[]>()
  for (const link of links) {
    const mode: DepMode = link.mode === 'any' ? 'any' : 'all'
    const list = groups.get(mode) ?? []
    list.push(link)
    groups.set(mode, list)
  }
  for (const [mode, list] of groups) {
    const results = list.map((link) => {
      const match = latest(pool.filter((item) => item.templateid === link.dependsonid && inScope(item, task)))
      if (!match) return 'missing'
      return match.status === 'Done' ? 'done' : 'open'
    })
    if (mode === 'any') {
      if (results.includes('done')) continue
      if (results.every((result) => result === 'missing')) return { satisfied: false, missing: true }
      return { satisfied: false, missing: false }
    }
    if (results.some((result) => result === 'missing')) return { satisfied: false, missing: true }
    if (results.some((result) => result === 'open')) return { satisfied: false, missing: false }
  }
  return { satisfied: true, missing: false }
}

export function initialStatus(input: {
  istimelock: boolean
  triggertype: string
  sameTeam: DepLink[]
  crossTeam: DepLink[]
  pool: ScopeInstance[]
  task: { clientid: string | null; projectid: string | null; periodkey: string; dueat: number }
}): { status: 'ToDo' | 'Locked' | 'WaitingOnInput'; noinputflag: boolean } {
  if (input.istimelock) return { status: 'ToDo', noinputflag: false }
  const same = linksSatisfied(input.sameTeam, input.pool, input.task)
  const cross = linksSatisfied(input.crossTeam, input.pool, input.task)
  if (same.missing || cross.missing) return { status: 'ToDo', noinputflag: true }
  if (same.satisfied && cross.satisfied) return { status: 'ToDo', noinputflag: false }
  if (input.triggertype === 'Dependent' && input.crossTeam.length > 0 && !cross.satisfied) {
    return { status: 'WaitingOnInput', noinputflag: false }
  }
  return { status: 'Locked', noinputflag: false }
}

export function canTransition(from: string, to: string, actor: Actor, istimelock = false): boolean {
  if (istimelock && from === 'ToDo' && to === 'Done' && actor !== 'system') return true
  if (to === 'Cancelled') return actor === 'coordinator' || actor === 'admin'
  const table: Record<string, Array<{ to: string; actors: Actor[] }>> = {
    Locked: [{ to: 'ToDo', actors: ['system'] }],
    ToDo: [{ to: 'InProgress', actors: ['assignee', 'coordinator', 'admin'] }],
    InProgress: [
      { to: 'InReview', actors: ['assignee', 'coordinator', 'admin'] },
      { to: 'WaitingOnInput', actors: ['assignee', 'coordinator', 'admin'] },
      { to: 'Done', actors: ['assignee', 'coordinator', 'admin'] },
    ],
    WaitingOnInput: [{ to: 'ToDo', actors: ['system', 'coordinator', 'admin'] }],
    InReview: [
      { to: 'Done', actors: ['coordinator', 'admin'] },
      { to: 'ToDo', actors: ['coordinator', 'admin'] },
    ],
    Done: [{ to: 'ToDo', actors: ['admin'] }],
  }
  return table[from]?.some((row) => row.to === to && row.actors.includes(actor)) ?? false
}

export function actionLabel(from: string, to: string): string {
  if (to === 'Done') return 'Done'
  if (to === 'InProgress') return 'Start'
  if (to === 'InReview') return 'Send for review'
  if (to === 'WaitingOnInput') return 'Waiting on input'
  if (to === 'Cancelled') return 'Cancel'
  if (to === 'ToDo' && from === 'InReview') return 'Client sent changes'
  if (to === 'ToDo' && from === 'Done') return 'Reopen'
  if (to === 'ToDo') return 'To Do'
  return STATUS_LABEL[to] || to
}

export function actionsFor(status: string, actor: Actor, istimelock: boolean): string[] {
  return ['ToDo', 'InProgress', 'WaitingOnInput', 'InReview', 'Done', 'Cancelled'].filter((to) =>
    canTransition(status, to, actor, istimelock)
  )
}

export function istDateKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

export function workingMinutesBetween(startMs: number, endMs: number, holidays: ReadonlySet<string>): number {
  if (endMs <= startMs) return 0
  let total = 0
  let cursor = istDateKey(startMs)
  const last = istDateKey(endMs)
  while (cursor <= last) {
    if (isWorkingDay(cursor, holidays)) {
      const open = Date.parse(`${cursor}T10:00:00+05:30`)
      const close = Date.parse(`${cursor}T18:30:00+05:30`)
      const from = Math.max(startMs, open)
      const to = Math.min(endMs, close)
      if (to > from) total += Math.floor((to - from) / 60000)
    }
    if (cursor === last) break
    cursor = shiftKey(cursor, 1)
  }
  return total
}

export function workingDaysAfter(dueKey: string, todayKey: string, holidays: ReadonlySet<string>): number {
  if (todayKey <= dueKey) return 0
  let count = 0
  let cursor = shiftKey(dueKey, 1)
  while (cursor <= todayKey) {
    if (isWorkingDay(cursor, holidays)) count += 1
    cursor = shiftKey(cursor, 1)
  }
  return count
}

export function escalationTarget(input: {
  dueAtMs: number
  nowMs: number
  priority: string
  istimelock: boolean
  status: string
  holidays: ReadonlySet<string>
}): 'none' | 'contact' | 'admins' {
  if (input.istimelock) return 'none'
  if (input.status === 'Done' || input.status === 'Cancelled' || input.status === 'Approved') return 'none'
  if (input.priority === 'High' && workingMinutesBetween(input.dueAtMs, input.nowMs, input.holidays) >= 240) {
    return 'admins'
  }
  const days = workingDaysAfter(istDateKey(input.dueAtMs), istDateKey(input.nowMs), input.holidays)
  if (days >= 2) return 'admins'
  if (days >= 1) return 'contact'
  return 'none'
}

export function topoTemplates(ids: string[], edges: Array<[string, string]>): string[] {
  const incoming = new Map<string, number>()
  const next = new Map<string, string[]>()
  for (const id of ids) {
    incoming.set(id, 0)
    next.set(id, [])
  }
  for (const [templateid, dependsonid] of edges) {
    if (!incoming.has(templateid) || !incoming.has(dependsonid)) continue
    next.get(dependsonid)?.push(templateid)
    incoming.set(templateid, (incoming.get(templateid) ?? 0) + 1)
  }
  const queue = ids.filter((id) => incoming.get(id) === 0)
  const ordered: string[] = []
  while (queue.length) {
    const id = queue.shift() as string
    ordered.push(id)
    for (const child of next.get(id) ?? []) {
      incoming.set(child, (incoming.get(child) ?? 1) - 1)
      if (incoming.get(child) === 0) queue.push(child)
    }
  }
  for (const id of ids) {
    if (!ordered.includes(id)) ordered.push(id)
  }
  return ordered
}
