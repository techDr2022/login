'use client'

import { useState, useTransition } from 'react'
import { TaskPriority } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createRecurrenceRule, createWorkflowTemplate, setRecurrenceActive } from '@/app/actions/automation-actions'

type AutomationData = {
  rules: Array<{
    id: string
    title: string
    cadence: string
    weekday: number | null
    active: boolean
    client: { name: string } | null
    assignee: { name: string } | null
    workflow: { name: string } | null
    runs: Array<{ status: string; error: string | null }>
  }>
  templates: Array<{ id: string; name: string; stages: Array<{ title: string }> }>
  users: Array<{ id: string; name: string }>
  clients: Array<{ id: string; name: string }>
  taskTypes: Array<{ taskType: string }>
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function AutomationPage({ data }: { data: AutomationData }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('daily')
  const [weekday, setWeekday] = useState('1')
  const [clientid, setClientid] = useState('')
  const [assigneeuserid, setAssigneeuserid] = useState('')
  const [tasktype, setTasktype] = useState('')
  const [workflowtemplateid, setWorkflowtemplateid] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('Medium')
  const [workflowName, setWorkflowName] = useState('')
  const [stagesText, setStagesText] = useState('Content writing\nDesign\nReview')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Automation</h1>
        <p className="text-sm text-muted-foreground">
          Daily and weekly tasks use the same task list. The manual task form stays as it is. The named onboarding workflow keeps running until you move a client onto a template.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader><CardTitle>New repeating task</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cadence</Label>
            <Select value={cadence} onValueChange={(value) => setCadence(value as 'daily' | 'weekly')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {cadence === 'weekly' && (
            <div className="space-y-1">
              <Label>Weekday</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day, index) => (
                    <SelectItem key={day} value={String(index + 1)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Client</Label>
            <Select value={clientid || 'none'} onValueChange={(value) => setClientid(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {data.clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assignee</Label>
            <Select value={assigneeuserid || 'none'} onValueChange={(value) => setAssigneeuserid(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {data.users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Task type</Label>
            <Select value={tasktype || 'none'} onValueChange={(value) => setTasktype(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {data.taskTypes.map((type) => (
                  <SelectItem key={type.taskType} value={type.taskType}>{type.taskType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Workflow</Label>
            <Select value={workflowtemplateid || 'none'} onValueChange={(value) => setWorkflowtemplateid(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Single task</SelectItem>
                {data.templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Low', 'Medium', 'High', 'Urgent'].map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button
              disabled={pending}
              onClick={() => {
                setError('')
                startTransition(async () => {
                  try {
                    await createRecurrenceRule({
                      title,
                      priority,
                      cadence,
                      weekday: Number(weekday),
                      clientid: clientid || undefined,
                      assigneeuserid: assigneeuserid || undefined,
                      tasktype: tasktype || undefined,
                      workflowtemplateid: workflowtemplateid || undefined,
                    })
                    setTitle('')
                    window.location.reload()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not save the rule')
                  }
                })
              }}
            >
              Save rule
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Workflow template</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">One stage per line, in order. The next stage is created when the previous task is approved. Leave or an inactive person leaves that stage unassigned.</p>
          <Input placeholder="Template name" value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} />
          <Textarea value={stagesText} onChange={(event) => setStagesText(event.target.value)} rows={4} />
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError('')
              startTransition(async () => {
                try {
                  await createWorkflowTemplate({
                    name: workflowName,
                    stages: stagesText.split('\n').map((titleLine) => ({ title: titleLine })),
                  })
                  window.location.reload()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not save the workflow')
                }
              })
            }}
          >
            Save workflow
          </Button>
          <ul className="text-sm text-muted-foreground">
            {data.templates.map((template) => (
              <li key={template.id}>{template.name}: {template.stages.map((stage) => stage.title).join(' → ')}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.rules.length === 0 && <p className="text-sm text-muted-foreground">No rules yet.</p>}
          {data.rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{rule.title}</p>
                <p className="text-muted-foreground">
                  {rule.cadence}{rule.weekday ? ` · ${WEEKDAYS[rule.weekday - 1]}` : ''} · {rule.client?.name || 'No client'} · {rule.workflow?.name || rule.assignee?.name || 'Unassigned'}
                  {rule.runs[0] ? ` · last ${rule.runs[0].status}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => startTransition(async () => {
                  await setRecurrenceActive(rule.id, !rule.active)
                  window.location.reload()
                })}
              >
                {rule.active ? 'Pause' : 'Resume'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
