import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addWorkingDays,
  canTransition,
  datesToCheck,
  dueClock,
  engineActor,
  engineKey,
  escalationTarget,
  initialStatus,
  isTimeBlockTemplate,
  planInstances,
  type DepLink,
  type ScopeInstance,
  type TemplatePlan,
} from './rules'

const none = new Set<string>()

function task(partial: Partial<ScopeInstance> & Pick<ScopeInstance, 'templateid' | 'status'>): ScopeInstance {
  return {
    dueat: 10,
    clientid: 'client',
    projectid: 'website',
    periodkey: 'website',
    ...partial,
  }
}

const scope = { clientid: 'client', projectid: 'website', periodkey: 'website', dueat: 20 }

describe('website unlock chain', () => {
  const am1Cross: DepLink[] = [{ dependsonid: 'RAG-W5', kind: 'cross-team', mode: 'all' }]
  const w6Same: DepLink[] = [{ dependsonid: 'RAG-W5', kind: 'same-team', mode: 'all' }]
  const w6Cross: DepLink[] = [{ dependsonid: 'SHA-AM1', kind: 'cross-team', mode: 'all' }]

  it('keeps SHA-AM1 waiting until RAG-W5 is done', () => {
    const status = initialStatus({
      istimelock: false,
      triggertype: 'Dependent',
      sameTeam: [],
      crossTeam: am1Cross,
      pool: [task({ templateid: 'RAG-W5', status: 'InProgress', dueat: 5 })],
      task: scope,
    })
    assert.equal(status.status, 'WaitingOnInput')
    assert.equal(status.noinputflag, false)
  })

  it('marking RAG-W5 done unlocks SHA-AM1', () => {
    const status = initialStatus({
      istimelock: false,
      triggertype: 'Dependent',
      sameTeam: [],
      crossTeam: am1Cross,
      pool: [task({ templateid: 'RAG-W5', status: 'Done', dueat: 5 })],
      task: scope,
    })
    assert.equal(status.status, 'ToDo')
  })

  it('marking SHA-AM1 done unlocks RAG-W6 only after RAG-W5 is done', () => {
    const waiting = initialStatus({
      istimelock: false,
      triggertype: 'Dependent',
      sameTeam: w6Same,
      crossTeam: w6Cross,
      pool: [
        task({ templateid: 'RAG-W5', status: 'Done', dueat: 5 }),
        task({ templateid: 'SHA-AM1', status: 'InProgress', dueat: 8 }),
      ],
      task: scope,
    })
    assert.equal(waiting.status, 'WaitingOnInput')

    const unlocked = initialStatus({
      istimelock: false,
      triggertype: 'Dependent',
      sameTeam: w6Same,
      crossTeam: w6Cross,
      pool: [
        task({ templateid: 'RAG-W5', status: 'Done', dueat: 5 }),
        task({ templateid: 'SHA-AM1', status: 'Done', dueat: 8 }),
      ],
      task: scope,
    })
    assert.equal(unlocked.status, 'ToDo')
  })

  it('does not lock forever when the provider instance is missing', () => {
    const status = initialStatus({
      istimelock: false,
      triggertype: 'Dependent',
      sameTeam: [],
      crossTeam: am1Cross,
      pool: [],
      task: scope,
    })
    assert.deepEqual(status, { status: 'ToDo', noinputflag: true })
  })
})

describe('scheduler', () => {
  const daily: TemplatePlan = {
    id: 'SHA-S1',
    repeat: 'Daily',
    timeorday: '10 AM / 2 PM / 5 PM',
    section: 'Coordination',
    triggertype: 'Auto (Scheduled)',
    perclient: false,
    assigneeIds: ['sha'],
  }
  const block: TemplatePlan = {
    id: 'MKT-DS1',
    repeat: 'Daily (Mon–Sat)',
    timeorday: '10:00–10:30 AM',
    section: 'Daily Schedule',
    triggertype: 'Auto (Scheduled)',
    perclient: false,
    assigneeIds: ['gou', 'aye'],
  }
  const monthly: TemplatePlan = {
    id: 'MKT-X1',
    repeat: 'Monthly',
    timeorday: 'By 15th',
    section: 'Social Media & Content',
    triggertype: 'Auto (Scheduled)',
    perclient: true,
    assigneeIds: ['gou'],
  }

  it('creates a Monday daily task and skips Sunday', () => {
    const planned = planInstances({
      templates: [daily],
      clients: [],
      todayKey: '2026-10-26',
      holidays: none,
    })
    const keys = planned.map((item) => item.enginekey)
    assert.ok(keys.includes(engineKey('SHA-S1', null, '2026-10-26', 'sha')))
    assert.equal(keys.some((key) => key.includes('2026-10-25')), false)
  })

  it('creates one daily-schedule instance per person and does not backfill time blocks', () => {
    const planned = planInstances({
      templates: [block],
      clients: [],
      todayKey: '2026-10-26',
      holidays: none,
    })
    assert.deepEqual(
      planned.map((item) => item.enginekey).sort(),
      [engineKey('MKT-DS1', null, '2026-10-26', 'aye'), engineKey('MKT-DS1', null, '2026-10-26', 'gou')].sort()
    )
    assert.equal(isTimeBlockTemplate(block), true)
    assert.equal(isTimeBlockTemplate({ id: 'MKT-DS7', section: 'Daily Schedule' }), false)
  })

  it('creates the 15th monthly task on the 12th, once per client', () => {
    const planned = planInstances({
      templates: [monthly],
      clients: [
        { id: 'c1', ownerid: 'gou' },
        { id: 'c2', ownerid: 'other' },
      ],
      todayKey: '2026-10-12',
      holidays: none,
    })
    assert.equal(planned.length, 2)
    assert.equal(planned.every((item) => item.periodkey === '2026-10' && item.dueKey === '2026-10-15'), true)
    const owned = planned.find((item) => item.clientid === 'c1')
    const other = planned.find((item) => item.clientid === 'c2')
    assert.equal(owned?.assigneeid, 'gou')
    assert.equal(other?.assigneeid, 'gou')
  })

  it('is stable when the same day is planned twice', () => {
    const input = {
      templates: [daily, block],
      clients: [],
      todayKey: '2026-10-26',
      holidays: none,
    }
    assert.deepEqual(planInstances(input).map((item) => item.enginekey), planInstances(input).map((item) => item.enginekey))
  })

  it('parses due clocks and monthly lead time', () => {
    assert.deepEqual(dueClock('10:00–10:30 AM'), { start: 10 * 60, due: 10 * 60 + 30 })
    assert.deepEqual(dueClock('4:00 PM'), { start: 16 * 60, due: 16 * 60 })
    assert.deepEqual(dueClock('11:00 AM–1:00 PM'), { start: 11 * 60, due: 13 * 60 })
    assert.equal(addWorkingDays('2026-10-15', -3, none), '2026-10-12')
    assert.equal(addWorkingDays('2026-10-05', -3, none), '2026-10-01')
    assert.deepEqual(datesToCheck('2026-10-26', none)[0], '2026-10-26')
  })
})

describe('escalation', () => {
  const holidays = new Set<string>()

  it('sends high priority to admins after 4 working hours', () => {
    const due = Date.parse('2026-10-26T10:00:00+05:30')
    const before = Date.parse('2026-10-26T13:00:00+05:30')
    const after = Date.parse('2026-10-26T14:00:00+05:30')
    assert.equal(escalationTarget({ dueAtMs: due, nowMs: before, priority: 'High', istimelock: false, status: 'ToDo', holidays }), 'none')
    assert.equal(escalationTarget({ dueAtMs: due, nowMs: after, priority: 'High', istimelock: false, status: 'ToDo', holidays }), 'admins')
  })

  it('alerts the contact after 1 working day and both admins after 2', () => {
    const due = Date.parse('2026-10-26T18:00:00+05:30')
    const tuesday = Date.parse('2026-10-27T11:00:00+05:30')
    const wednesday = Date.parse('2026-10-28T11:00:00+05:30')
    assert.equal(escalationTarget({ dueAtMs: due, nowMs: tuesday, priority: 'Medium', istimelock: false, status: 'ToDo', holidays }), 'contact')
    assert.equal(escalationTarget({ dueAtMs: due, nowMs: wednesday, priority: 'Medium', istimelock: false, status: 'ToDo', holidays }), 'admins')
  })

  it('never escalates a time block', () => {
    const due = Date.parse('2026-10-26T10:00:00+05:30')
    const later = Date.parse('2026-10-28T16:00:00+05:30')
    assert.equal(escalationTarget({ dueAtMs: due, nowMs: later, priority: 'High', istimelock: true, status: 'ToDo', holidays }), 'none')
  })
})

describe('task completion', () => {
  it('lets the assignee finish a review without an admin', () => {
    assert.equal(canTransition('InReview', 'Done', 'assignee'), true)
    assert.equal(canTransition('InReview', 'Done', 'coordinator'), true)
    assert.equal(canTransition('InReview', 'Done', 'admin'), false)
    assert.equal(engineActor('SUPER_ADMIN', true), 'assignee')
    assert.equal(engineActor('SUPER_ADMIN', false), 'admin')
  })
})
