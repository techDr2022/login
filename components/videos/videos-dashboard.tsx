'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Video,
  Film,
  Send,
  AlertCircle,
  CheckCircle2,
  Edit,
  Search,
  Calendar,
  Target,
} from 'lucide-react'
import { format } from 'date-fns'
import { getClientVideos, updateClientVideoMonth, ClientVideoRow } from '@/app/actions/video-actions'
import { getVideosTarget } from '@/lib/videos-config'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = format(d, 'MMMM yyyy')
    options.push({ value, label })
  }
  return options
}

export function VideosDashboard() {
  const [rows, setRows] = useState<ClientVideoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [monthKey, setMonthKey] = useState<string>(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [clientSearch, setClientSearch] = useState('')
  const [editingRow, setEditingRow] = useState<ClientVideoRow | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    rawCount: 0,
    editedCount: 0,
    postedCount: 0,
    lastShootDate: null as Date | null,
    notes: '',
  })
  const defaultTargetPerMonth = getVideosTarget()
  const monthOptions = getMonthOptions()

  useEffect(() => {
    loadVideos()
  }, [monthKey])

  const loadVideos = async () => {
    try {
      setLoading(true)
      const data = await getClientVideos(monthKey)
      setRows(data)
    } catch (error) {
      console.error('Error loading videos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (row: ClientVideoRow) => {
    setEditingRow(row)
    setFormData({
      rawCount: row.rawCount,
      editedCount: row.editedCount,
      postedCount: row.postedCount,
      lastShootDate: row.lastShootDate ? new Date(row.lastShootDate) : null,
      notes: row.notes ?? '',
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingRow) return
    try {
      await updateClientVideoMonth(editingRow.clientId, editingRow.monthKey, {
        rawCount: formData.rawCount,
        editedCount: formData.editedCount,
        postedCount: formData.postedCount,
        lastShootDate: formData.lastShootDate,
        notes: formData.notes || null,
      })
      setIsDialogOpen(false)
      setEditingRow(null)
      await loadVideos()
    } catch (error) {
      console.error('Error updating video stats:', error)
      alert('Failed to update. Please try again.')
    }
  }

  const searchLower = clientSearch.trim().toLowerCase()
  const filteredRows = rows.filter((row) => {
    if (!searchLower) return true
    return (
      row.name.toLowerCase().includes(searchLower) ||
      (row.doctorOrHospitalName ?? '').toLowerCase().includes(searchLower)
    )
  })

  const totalRaw = rows.reduce((s, r) => s + r.rawCount, 0)
  const totalEdited = rows.reduce((s, r) => s + r.editedCount, 0)
  const totalPosted = rows.reduce((s, r) => s + r.postedCount, 0)
  const clientsBehind = rows.filter((r) => r.postedCount < r.targetCount).length
  const clientsOnTrack = rows.filter((r) => r.postedCount >= r.targetCount).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading videos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Reels & Videos</p>
        <h1 className="text-2xl font-semibold">Videos Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Raw (this month)
            </CardTitle>
            <Film className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRaw}</div>
            <p className="text-xs text-muted-foreground mt-1">Shot & copied to office</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Edited (this month)
            </CardTitle>
            <Video className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalEdited}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to post</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Posted (this month)
            </CardTitle>
            <Send className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalPosted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Client-specific targets (default {defaultTargetPerMonth} per client)
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              On track
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{clientsOnTrack}</div>
            <p className="text-xs text-muted-foreground mt-1">Posted ≥ {targetPerMonth}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Behind target
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{clientsBehind}</div>
            <p className="text-xs text-muted-foreground mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-lg">Client videos</CardTitle>
              <CardDescription>
                Raw (shot at location), edited, and posted counts. Targets are set per client
                (default {defaultTargetPerMonth} posts per month).
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-8 w-48 pl-8"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="monthSelect" className="text-xs text-muted-foreground">
                  Month
                </Label>
                <Select value={monthKey} onValueChange={setMonthKey}>
                  <SelectTrigger id="monthSelect" className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="flex items-center gap-2">
                <Target className="h-3 w-3" />
                Default: {defaultTargetPerMonth} posts/client/month
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <Video className="h-16 w-16 text-muted-foreground/50" />
              <div className="space-y-2">
                <p className="text-lg font-medium">No clients found</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Add clients from the Clients page. Then use Edit on a row to log raw, edited, and
                  posted video counts for each month.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-center">Raw</TableHead>
                    <TableHead className="text-center">Edited</TableHead>
                    <TableHead className="text-center">Posted</TableHead>
                    <TableHead className="text-center">Target</TableHead>
                    <TableHead>Last shoot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const isBehind = row.postedCount < row.targetCount
                    const isOnTrack = row.postedCount >= row.targetCount
                    return (
                      <TableRow
                        key={row.clientId}
                        className={
                          isBehind ? 'bg-amber-50/80 dark:bg-amber-950/20' : ''
                        }
                      >
                        <TableCell className="font-medium">
                          <div>
                            <div>{row.name}</div>
                            {row.doctorOrHospitalName && (
                              <div className="text-xs text-muted-foreground">
                                {row.doctorOrHospitalName}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{row.rawCount}</TableCell>
                        <TableCell className="text-center">{row.editedCount}</TableCell>
                        <TableCell className="text-center font-medium">{row.postedCount}</TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {row.targetCount}
                        </TableCell>
                        <TableCell>
                          {row.lastShootDate
                            ? format(new Date(row.lastShootDate), 'MMM d, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {isOnTrack ? (
                            <Badge variant="default" className="bg-green-600">
                              On track
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-amber-700 bg-amber-100">
                              Behind ({Math.max(row.targetCount - row.postedCount, 0)} left)
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit video stats</DialogTitle>
            <DialogDescription>
              Update raw, edited, and posted counts for {editingRow?.name} — {monthKey}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Raw</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.rawCount}
                  onChange={(e) =>
                    setFormData({ ...formData, rawCount: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">Shot & copied</p>
              </div>
              <div className="space-y-2">
                <Label>Edited</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.editedCount}
                  onChange={(e) =>
                    setFormData({ ...formData, editedCount: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">Ready to post</p>
              </div>
              <div className="space-y-2">
                <Label>Posted</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.postedCount}
                  onChange={(e) =>
                    setFormData({ ...formData, postedCount: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Target {editingRow?.targetCount ?? defaultTargetPerMonth}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Last shoot date</Label>
              <DatePicker
                date={formData.lastShootDate}
                onSelect={(date) => setFormData({ ...formData, lastShootDate: date })}
              />
              <p className="text-xs text-muted-foreground">Last day you shot at this client</p>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
