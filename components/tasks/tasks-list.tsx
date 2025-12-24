'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Search, Trash2, Edit, CheckSquare2 } from 'lucide-react'
import { createTask, updateTask, deleteTask, updateTaskStatus } from '@/app/actions/task-actions'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { canManageTasks } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  assignedToId?: string
  clientId?: string
  dueDate?: string
  timeSpent?: number
  assignedTo?: {
    id: string
    name: string
    email: string
  }
  assignedBy?: {
    id: string
    name: string
  }
  client?: {
    id: string
    name: string
  }
}

export function TasksList() {
  const { data: session } = useSession()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedByMeFilter, setAssignedByMeFilter] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [updatingStatusTask, setUpdatingStatusTask] = useState<Task | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Urgent',
    assignedToId: '',
    clientId: '',
    dueDate: '',
    timeSpent: 0,
  })
  const [statusFormData, setStatusFormData] = useState({
    status: 'Pending' as 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected',
    rejectionFeedback: '',
  })
  const [error, setError] = useState('')

  const canManage = session?.user.role && canManageTasks(session.user.role as UserRole)
  const isEmployee = session?.user.role === UserRole.EMPLOYEE

  useEffect(() => {
    fetchTasks()
    // Everyone can fetch clients and employees for task assignment
    fetchClients()
    fetchEmployees()
  }, [page, search, statusFilter, priorityFilter, assignedByMeFilter])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients?limit=1000')
      const data = await res.json()
      setClients(data.clients || [])
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    }
  }

  const fetchEmployees = async () => {
    try {
      // Fetch all users so tasks can be assigned to anyone
      const res = await fetch('/api/users')
      const data = await res.json()
      setEmployees(data.users || [])
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
        ...(assignedByMeFilter && session?.user?.id && { assignedById: session.user.id }),
      })
      const res = await fetch(`/api/tasks?${params}`)
      const data = await res.json()
      setTasks(data.tasks || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err) {
      setError('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const taskData = {
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        assignedToId: formData.assignedToId || undefined,
        clientId: formData.clientId || undefined,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        timeSpent: formData.timeSpent,
      }

      if (editingTask) {
        await updateTask(editingTask.id, taskData)
      } else {
        await createTask(taskData)
      }
      
      setDialogOpen(false)
      resetForm()
      fetchTasks()
    } catch (err: any) {
      setError(err.message || 'Failed to save task')
    }
  }

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!updatingStatusTask) return

    try {
      await updateTaskStatus(updatingStatusTask.id, {
        status: statusFormData.status,
        rejectionFeedback: statusFormData.rejectionFeedback || undefined,
      })
      
      setStatusDialogOpen(false)
      setUpdatingStatusTask(null)
      setStatusFormData({
        status: 'Pending',
        rejectionFeedback: '',
      })
      fetchTasks()
    } catch (err: any) {
      setError(err.message || 'Failed to update task status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await deleteTask(id)
      fetchTasks()
    } catch (err: any) {
      setError(err.message || 'Failed to delete task')
    }
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority as any,
      assignedToId: task.assignedToId || '',
      clientId: task.clientId || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      timeSpent: task.timeSpent || 0,
    })
    setDialogOpen(true)
  }

  const handleStatusUpdate = (task: Task) => {
    setUpdatingStatusTask(task)
    setStatusFormData({
      status: task.status as any,
      rejectionFeedback: '',
    })
    setStatusDialogOpen(true)
  }

  const resetForm = () => {
    setEditingTask(null)
    setFormData({
      title: '',
      description: '',
      priority: 'Medium',
      assignedToId: '',
      clientId: '',
      dueDate: '',
      timeSpent: 0,
    })
    setError('')
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'outline'
      case 'Rejected':
        return 'outline'
      case 'Review':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'destructive'
      case 'High':
        return 'default'
      default:
        return 'secondary'
    }
  }

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10 rounded-xl"
            />
          </div>
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(value) => {
          setStatusFilter(value === 'all' ? '' : value)
          setPage(1)
        }}>
          <SelectTrigger className="w-[180px] rounded-xl">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="InProgress">In Progress</SelectItem>
            <SelectItem value="Review">Review</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter || 'all'} onValueChange={(value) => {
          setPriorityFilter(value === 'all' ? '' : value)
          setPage(1)
        }}>
          <SelectTrigger className="w-[180px] rounded-xl">
            <SelectValue placeholder="All Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Button
            variant={assignedByMeFilter ? "default" : "outline"}
            onClick={() => {
              setAssignedByMeFilter(!assignedByMeFilter)
              setPage(1)
            }}
            className="rounded-xl"
          >
            {assignedByMeFilter ? (
              <>
                <CheckSquare2 className="w-4 h-4 mr-2" />
                Assigned by You
              </>
            ) : (
              <>
                <CheckSquare2 className="w-4 h-4 mr-2" />
                Show Assigned by You
              </>
            )}
          </Button>
        )}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
                  <DialogDescription>
                    {editingTask ? 'Update task information' : 'Create a new task'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="assignedToId">Assigned To</Label>
                      <Select
                        value={formData.assignedToId || undefined}
                        onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="clientId">Client</Label>
                      <Select
                        value={formData.clientId || undefined}
                        onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select client (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dueDate">Due Date</Label>
                      <DatePicker
                        date={formData.dueDate ? new Date(formData.dueDate) : null}
                        onSelect={(date) => setFormData({ ...formData, dueDate: date ? date.toISOString().split('T')[0] : '' })}
                        placeholder="Select due date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timeSpent">Time Spent (hours)</Label>
                      <Input
                        id="timeSpent"
                        type="number"
                        step="0.1"
                        value={formData.timeSpent}
                        onChange={(e) => setFormData({ ...formData, timeSpent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Assigned To</TableHead>
                {canManage && <TableHead>Assigned By</TableHead>}
                <TableHead>Client</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 8 : 6} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center py-8">
                      <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-sm font-medium text-muted-foreground">No tasks found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Get started by creating a new task
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow 
                    key={task.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors" 
                    onClick={() => router.push(`/tasks/${task.id}`)}
                  >
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.assignedTo?.name || 'Unassigned'}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-muted-foreground">
                        {task.assignedBy?.name || '-'}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">{task.client?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getPriorityBadgeVariant(task.priority)}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(task.status)}
                        className={
                          task.status === 'Approved'
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : task.status === 'Rejected'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : ''
                        }
                      >
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                    </TableCell>
                    {canManage && (
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                        <div className="flex justify-end gap-2">
                          {!isEmployee && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusUpdate(task)}
                            >
                              Update Status
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(task)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(task.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => {
        setStatusDialogOpen(open)
        if (!open) {
          setUpdatingStatusTask(null)
          setStatusFormData({ status: 'Pending', rejectionFeedback: '' })
        }
      }}>
        <DialogContent>
          <form onSubmit={handleStatusSubmit}>
            <DialogHeader>
              <DialogTitle>Update Task Status</DialogTitle>
              <DialogDescription>
                Update the status of this task
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={statusFormData.status}
                  onValueChange={(value) => setStatusFormData({ ...statusFormData, status: value as any })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="InProgress">In Progress</SelectItem>
                    <SelectItem value="Review">Review</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {statusFormData.status === 'Rejected' && (
                <div>
                  <Label htmlFor="rejectionFeedback">Rejection Feedback *</Label>
                  <Textarea
                    id="rejectionFeedback"
                    value={statusFormData.rejectionFeedback}
                    onChange={(e) => setStatusFormData({ ...statusFormData, rejectionFeedback: e.target.value })}
                    required
                    placeholder="Please provide feedback for rejection..."
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

