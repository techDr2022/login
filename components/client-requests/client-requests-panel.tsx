'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import {
  ClientRequestStatus,
  ClientRequestType,
} from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import {
  createClientRequest,
  deleteClientRequest,
  getClientRequests,
  updateClientRequest,
} from '@/app/actions/client-request-actions'
import { format } from 'date-fns'
import { useSession } from 'next-auth/react'

export type SerializedClientRequestRow = {
  id: string
  source: string
  clientId: string | null
  clientName: string | null
  contactPhone: string | null
  requestType: ClientRequestType
  summary: string
  notes: string | null
  status: ClientRequestStatus
  receivedAt: string
  createdById: string
  createdAt: string
  updatedAt: string
  Client: { id: string; name: string; doctorOrHospitalName: string } | null
  createdBy: { id: string; name: string }
  assignees: { id: string; name: string }[]
}

const TYPE_LABEL: Record<ClientRequestType, string> = {
  POSTER: 'Poster',
  VIDEO: 'Video',
  POSTER_AND_VIDEO: 'Poster + video',
  OTHER: 'Other',
}

const STATUS_LABEL: Record<ClientRequestStatus, string> = {
  NEW: 'New',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  NOT_DOING: 'Not doing',
}

function statusBadgeVariant(
  s: ClientRequestStatus
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (s) {
    case 'NEW':
      return 'secondary'
    case 'IN_PROGRESS':
      return 'default'
    case 'DONE':
      return 'outline'
    case 'NOT_DOING':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function emptyForm(createdById = '') {
  return {
    clientId: '' as string,
    clientName: '',
    contactPhone: '',
    requestType: 'POSTER' as ClientRequestType,
    summary: '',
    notes: '',
    status: 'NEW' as ClientRequestStatus,
    createdById: createdById as string,
    assigneeIds: [] as string[],
    receivedAt: new Date(),
  }
}

export function ClientRequestsPanel({
  initialRequests,
}: {
  initialRequests: SerializedClientRequestRow[]
}) {
  const { data: session } = useSession()
  const [rows, setRows] = useState(initialRequests)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(() => emptyForm())
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [isPending, startTransition] = useTransition()

  const refresh = useCallback(() => {
    startTransition(async () => {
      const next = await getClientRequests()
      setRows(
        next.map((r) => {
          const { assignees, ...rest } = r
          return {
            ...rest,
            receivedAt: r.receivedAt.toISOString(),
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            assignees: assignees.map((a) => ({ id: a.user.id, name: a.user.name })),
          }
        })
      )
    })
  }, [])

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm(session?.user?.id ?? ''))
    setDialogOpen(true)
  }

  const openEdit = (r: SerializedClientRequestRow) => {
    setEditingId(r.id)
    setForm({
      clientId: r.clientId ?? '',
      clientName: r.clientName ?? '',
      contactPhone: r.contactPhone ?? '',
      requestType: r.requestType,
      summary: r.summary,
      notes: r.notes ?? '',
      status: r.status,
      createdById: r.createdById,
      assigneeIds: r.assignees.map((a) => a.id),
      receivedAt: new Date(r.receivedAt),
    })
    setDialogOpen(true)
  }

  const loadLookups = useCallback(() => {
    void (async () => {
      try {
        const [cRes, uRes] = await Promise.all([
          fetch('/api/clients?limit=1000'),
          fetch('/api/users'),
        ])
        const cJson = await cRes.json()
        const uJson = await uRes.json()
        const clientList = (cJson.clients || []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))
        const userList = (uJson.users || []).map((u: { id: string; name: string }) => ({
          id: u.id,
          name: u.name,
        }))
        setClients(clientList)
        setUsers(userList)
      } catch {
        // ignore
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      const clientLabel =
        r.Client?.name ||
        r.Client?.doctorOrHospitalName ||
        r.clientName ||
        ''
      const hay = [
        r.summary,
        r.notes,
        clientLabel,
        r.contactPhone,
        TYPE_LABEL[r.requestType],
        r.createdBy?.name,
        ...r.assignees.map((a) => a.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search, statusFilter])

  const displayClient = (r: SerializedClientRequestRow) => {
    if (r.Client) {
      return r.Client.name || r.Client.doctorOrHospitalName
    }
    return r.clientName || '—'
  }

  const submit = () => {
    startTransition(async () => {
      try {
        if (editingId) {
          await updateClientRequest(editingId, {
            clientId: form.clientId || null,
            clientName: form.clientName || null,
            contactPhone: form.contactPhone || null,
            requestType: form.requestType,
            summary: form.summary,
            notes: form.notes || null,
            status: form.status,
            receivedAt: form.receivedAt,
            createdById: form.createdById || null,
            assigneeIds: form.assigneeIds,
          })
        } else {
          await createClientRequest({
            clientId: form.clientId || null,
            clientName: form.clientName || null,
            contactPhone: form.contactPhone || null,
            requestType: form.requestType,
            summary: form.summary,
            notes: form.notes || null,
            receivedAt: form.receivedAt,
            createdById: form.createdById?.trim() || null,
            assigneeIds: form.assigneeIds,
          })
        }
        setDialogOpen(false)
        refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  const remove = (id: string) => {
    if (!confirm('Delete this request?')) return
    startTransition(async () => {
      try {
        await deleteClientRequest(id)
        refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="space-y-6">
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (o) loadLookups()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit request' : 'New request'}</DialogTitle>
                <DialogDescription>
                  Capture what the client asked for on WhatsApp. Link an existing client if you
                  have one.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>Existing client (optional)</Label>
                  <Select
                    value={form.clientId || '__none__'}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, clientId: v === '__none__' ? '' : v }))
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cr-clientName">Name / clinic (if not in list)</Label>
                  <Input
                    id="cr-clientName"
                    className="rounded-xl"
                    value={form.clientName}
                    onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                    placeholder="e.g. Dr. Rao — as on WhatsApp"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cr-phone">WhatsApp / phone (optional)</Label>
                  <Input
                    id="cr-phone"
                    className="rounded-xl"
                    value={form.contactPhone}
                    onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                    placeholder="+91…"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select
                    value={form.requestType}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, requestType: v as ClientRequestType }))
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as ClientRequestType[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {TYPE_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cr-summary">What they asked for</Label>
                  <Textarea
                    id="cr-summary"
                    className="rounded-xl min-h-[88px]"
                    value={form.summary}
                    onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                    placeholder="e.g. Diwali poster, 2 reel edits by Friday…"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cr-notes">Internal notes (optional)</Label>
                  <Textarea
                    id="cr-notes"
                    className="rounded-xl min-h-[64px]"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                {editingId && (
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, status: v as ClientRequestStatus }))
                      }
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as ClientRequestStatus[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {STATUS_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Received on</Label>
                  <DatePicker
                    date={form.receivedAt}
                    onSelect={(d) => setForm((f) => ({ ...f, receivedAt: d ?? new Date() }))}
                    placeholder="Pick date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Assigned by</Label>
                  <Select
                    value={form.createdById || '__none__'}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, createdById: v === '__none__' ? '' : v }))
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Assigned to (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Select one or more people responsible for this request.
                  </p>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border p-3">
                    {users.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Loading users…</p>
                    ) : (
                      users.map((u) => (
                        <label
                          key={u.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-muted/60"
                        >
                          <Checkbox
                            checked={form.assigneeIds.includes(u.id)}
                            onCheckedChange={(c) => {
                              const on = c === true
                              setForm((f) => ({
                                ...f,
                                assigneeIds: on
                                  ? Array.from(new Set([...f.assigneeIds, u.id]))
                                  : f.assigneeIds.filter((id) => id !== u.id),
                              }))
                            }}
                          />
                          <span className="text-sm">{u.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="rounded-xl" disabled={isPending} onClick={submit}>
                  {editingId ? 'Save' : 'Add'}
                </Button>
              </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Client requests</CardTitle>
            <CardDescription>
              Log WhatsApp asks for posters, videos, and other creative work so nothing slips
              through.
            </CardDescription>
          </div>
          <Button
            className="rounded-xl"
            onClick={() => {
              openNew()
              loadLookups()
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Log request
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="rounded-xl pl-9"
                placeholder="Search summary, client, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full rounded-xl sm:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as ClientRequestStatus[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="min-w-[200px]">Request</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned by</TableHead>
                  <TableHead className="min-w-[140px]">Assigned to</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No requests yet. Log the next WhatsApp ask so the team sees it here.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(r.receivedAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{displayClient(r)}</TableCell>
                      <TableCell>{TYPE_LABEL[r.requestType]}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="line-clamp-2 text-sm">{r.summary}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(r.status)}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.createdBy?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.assignees.length === 0
                          ? '—'
                          : r.assignees.map((a) => a.name).join(', ')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl"
                          onClick={() => {
                            loadLookups()
                            openEdit(r)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl text-destructive"
                          onClick={() => remove(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
