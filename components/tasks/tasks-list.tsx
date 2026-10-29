'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Search, Trash2, Edit, CheckSquare2 } from 'lucide-react'
import { createTask, updateTask, deleteTask, updateTaskStatus, deleteTasks } from '@/app/actions/task-actions'
import { getAllTaskTemplates } from '@/app/actions/task-template-actions'
import { Checkbox } from '@/components/ui/checkbox'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { canManageTasks } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'

const CLOSED_STATUSES = new Set(['Approved', 'Done', 'Cancelled', 'Rejected'])

const STATUS_TEXT: Record<string, string> = {
  Pending: 'Pending',
  InProgress: 'In progress',
  Review: 'Review',
  Approved: 'Done',
  Rejected: 'Rejected',
  Locked: 'Locked',
  ToDo: 'To do',
  WaitingOnInput: 'Waiting',
  InReview: 'In review',
  Done: 'Done',
  Cancelled: 'Cancelled',
}

const dueFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
})

function dueLabel(value: string | undefined, dueToday: boolean) {
  if (!value) return '—'
  if (dueToday) return 'Today'
  return dueFormat.format(new Date(value))
}

function isOpenDueToday(task: { dueDate?: string; status: string }) {
  if (!task.dueDate || CLOSED_STATUSES.has(task.status)) return false
  const due = new Date(task.dueDate)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return due >= start && due <= end
}

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  assignedToId?: string
  clientId?: string
  dueDate?: string
  createdAt?: string
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
  const [users, setUsers] = useState<Array<{ id: string; name: string; email?: string; role?: string }>>([])
  const [taskTemplates, setTaskTemplates] = useState<Array<{ taskType: string; durationHours: number; isActive: boolean }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedByMeFilter, setAssignedByMeFilter] = useState(false)
  const [assignedToMeFilter, setAssignedToMeFilter] = useState(false)
  const [employeeFilter, setEmployeeFilter] = useState('')
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
    taskType: '',
    dueDate: '',
    timeSpentHours: 0,
    timeSpentMinutes: 0,
  })
  const [statusFormData, setStatusFormData] = useState({
    status: 'Pending' as 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected',
    rejectionFeedback: '',
  })
  const [error, setError] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isQuickUpdating, setIsQuickUpdating] = useState<string | null>(null)

  const canManage = session?.user.role && canManageTasks(session.user.role as UserRole)

  useEffect(() => {
    fetchTasks()
    // Fetch clients and users for task assignment
    fetchClients()
    fetchUsers()
    fetchTaskTemplates()
  }, [page, search, statusFilter, priorityFilter, assignedByMeFilter, assignedToMeFilter, employeeFilter])

  // Real-time updates handled elsewhere; polling removed for performance.

  useEffect(() => {
    // Clear selection when tasks change (e.g., after deletion or filter change)
    setSelectedTasks(new Set())
  }, [tasks])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients?limit=1000')
      const data = await res.json()
      const assignable = (data.clients || []).filter(
        (client: { status?: string }) => client.status !== 'PAUSED'
      )
      setClients(assignable)
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      // Fetch all users so tasks can be assigned to anyone
      const res = await fetch('/api/users')
      const data = await res.json()
      const fetchedUsers = data.users || []
      setUsers(fetchedUsers)
      
      // Debug logging to help troubleshoot
      if (process.env.NODE_ENV === 'development') {
        console.log('Fetched users for task assignment:', fetchedUsers)
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  const fetchTaskTemplates = async () => {
    try {
      const templates = await getAllTaskTemplates()
      setTaskTemplates(templates.filter(t => t.isActive))
    } catch (err) {
      console.error('Failed to fetch task templates:', err)
    }
  }

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
        ...(assignedByMeFilter && session?.user?.id && { assignedById: session.user.id }),
        // Prioritize assignedToMeFilter over employeeFilter if both are active
        ...(assignedToMeFilter && session?.user?.id && { assignedToId: session.user.id }),
        ...(employeeFilter && canManage && !assignedToMeFilter && { assignedToId: employeeFilter }),
        _t: Date.now().toString(), // Cache busting parameter
      })
      const res = await fetch(`/api/tasks?${params}`, {
        cache: 'no-store', // Ensure no caching
      })
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
    setIsSubmitting(true)

    try {
      if (!formData.taskType && formData.dueDate) {
        const today = new Date()
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const [year, month, day] = formData.dueDate.split('-').map(Number)
        const selectedDateOnly = new Date(year, month - 1, day)
        if (selectedDateOnly < todayDateOnly) {
          setError('Due date cannot be in the past')
          return
        }
      }

      // Convert hours and minutes to decimal hours for storage
      const timeSpentInHours = formData.timeSpentHours + (formData.timeSpentMinutes / 60)

      const taskData: any = {
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        assignedToId: formData.assignedToId || undefined,
        clientId: formData.clientId || undefined,
        taskType: formData.taskType || undefined,
        timeSpent: timeSpentInHours > 0 ? timeSpentInHours : undefined,
      }

      // Only include dueDate if taskType is not provided (backward compatibility)
      if (!formData.taskType && formData.dueDate) {
        // Parse date string (YYYY-MM-DD) in local timezone to avoid timezone conversion issues
        const [year, month, day] = formData.dueDate.split('-').map(Number)
        const dueDate = new Date(year, month - 1, day, 18, 0, 0) // 6:00 PM in local timezone
        taskData.dueDate = dueDate
      }

      if (editingTask) {
        await updateTask(editingTask.id, taskData)
      } else {
        await createTask(taskData)
      }
      
      setDialogOpen(false)
      resetForm()
      // Immediately refresh tasks without waiting
      await fetchTasks()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to save task')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsUpdatingStatus(true)

    if (!updatingStatusTask) {
      setIsUpdatingStatus(false)
      return
    }

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
      // Immediately refresh tasks without waiting
      await fetchTasks()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update task status')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    setIsDeleting(id)
    try {
      await deleteTask(id)
      // Immediately refresh tasks without waiting
      await fetchTasks()
      setSelectedTasks(new Set())
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to delete task')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(tasks.map(task => task.id)))
    } else {
      setSelectedTasks(new Set())
    }
  }

  const handleSelectTask = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTasks)
    if (checked) {
      newSelected.add(taskId)
    } else {
      newSelected.delete(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return
    
    const count = selectedTasks.size
    if (!confirm(`Are you sure you want to delete ${count} task${count > 1 ? 's' : ''}?`)) return

    try {
      await deleteTasks(Array.from(selectedTasks))
      setSelectedTasks(new Set())
      // Immediately refresh tasks without waiting
      await fetchTasks()
    } catch (err: any) {
      setError(err.message || 'Failed to delete tasks')
    }
  }


  const handleEdit = (task: Task) => {
    setEditingTask(task)
    // Convert decimal hours back to hours and minutes
    const totalHours = task.timeSpent || 0
    const hours = Math.floor(totalHours)
    const minutes = Math.round((totalHours - hours) * 60)
    
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority as any,
      taskType: (task as any).taskType || '',
      assignedToId: task.assignedToId || '',
      clientId: task.clientId || '',
      dueDate: task.dueDate ? (() => {
        // Parse date in local timezone to avoid timezone conversion issues
        const date = new Date(task.dueDate)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      })() : '',
      timeSpentHours: hours,
      timeSpentMinutes: minutes,
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
      taskType: '',
      dueDate: '',
      timeSpentHours: 0,
      timeSpentMinutes: 0,
    })
    setError('')
  }

  const allSelected = useMemo(() => tasks.length > 0 && selectedTasks.size === tasks.length, [tasks.length, selectedTasks.size])

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
        {selectedTasks.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            className="rounded-xl"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({selectedTasks.size})
          </Button>
        )}
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
          <SelectTrigger className="w-[200px] rounded-xl">
            <SelectValue placeholder="All Tasks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="Pending">Pending Tasks</SelectItem>
            <SelectItem value="InProgress">In Progress Tasks</SelectItem>
            <SelectItem value="Approved">Completed Tasks</SelectItem>
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
          <Select value={employeeFilter || 'all'} onValueChange={(value) => {
            setEmployeeFilter(value === 'all' ? '' : value)
            setPage(1)
          }}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {users
                .filter((u) => u.role === UserRole.EMPLOYEE)
                .map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
        {/* Assigned to Me filter - available to all users */}
        <Button
          variant={assignedToMeFilter ? "default" : "outline"}
          onClick={() => {
            if (assignedToMeFilter) {
              // If already active, deactivate it
              setAssignedToMeFilter(false)
            } else {
              // Activate this filter and deactivate the other
              setAssignedToMeFilter(true)
              setAssignedByMeFilter(false)
            }
            setPage(1)
          }}
          className="rounded-xl"
        >
          <CheckSquare2 className="w-4 h-4 mr-2" />
          Assigned to Me
        </Button>
        {/* Assigned by Me filter - available to all users */}
        <Button
          variant={assignedByMeFilter ? "default" : "outline"}
          onClick={() => {
            if (assignedByMeFilter) {
              // If already active, deactivate it
              setAssignedByMeFilter(false)
            } else {
              // Activate this filter and deactivate the other
              setAssignedByMeFilter(true)
              setAssignedToMeFilter(false)
            }
            setPage(1)
          }}
          className="rounded-xl"
        >
          <CheckSquare2 className="w-4 h-4 mr-2" />
          Assigned by Me
        </Button>
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
                        <SelectTrigger id="priority">
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
                        onValueChange={(value) => setFormData({ ...formData, assignedToId: value === 'unassigned' ? '' : value })}
                      >
                        <SelectTrigger id="assignedToId">
                          <SelectValue placeholder="Select user (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{u.name}</span>
                                {u.email && (
                                  <span className="text-xs text-muted-foreground">{u.email}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {users.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          No users available. Make sure employees are active in the system.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="clientId">Client</Label>
                      <Select
                        value={formData.clientId || undefined}
                        onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                      >
                        <SelectTrigger id="clientId">
                          <SelectValue placeholder="Select client (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                          {formData.clientId &&
                            !clients.some((c) => c.id === formData.clientId) &&
                            editingTask?.client?.id === formData.clientId && (
                              <SelectItem value={editingTask.client.id}>
                                {editingTask.client.name}
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                  </div>
                  <div>
                    <Label htmlFor="taskType">Task Type</Label>
                    <Select
                      value={formData.taskType || undefined}
                      onValueChange={(value) => setFormData({ ...formData, taskType: value === 'none' ? '' : value, dueDate: '' })}
                    >
                      <SelectTrigger id="taskType">
                        <SelectValue placeholder="Select task type (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Manual Due Date)</SelectItem>
                        {taskTemplates.map((template) => (
                          <SelectItem key={template.taskType} value={template.taskType}>
                            {template.taskType} ({template.durationHours} {template.durationHours === 1 ? 'hour' : 'hours'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.taskType && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Due date will be automatically calculated based on task type
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Due Date {formData.taskType ? '(Auto-calculated)' : ''}</Label>
                      <DatePicker
                        date={formData.dueDate ? new Date(formData.dueDate + 'T00:00:00') : null}
                        onSelect={(date) => {
                          if (date) {
                            // Format date in local timezone to avoid timezone conversion issues
                            const year = date.getFullYear()
                            const month = String(date.getMonth() + 1).padStart(2, '0')
                            const day = String(date.getDate()).padStart(2, '0')
                            const dateString = `${year}-${month}-${day}`
                            setFormData({ ...formData, dueDate: dateString })
                          } else {
                            setFormData({ ...formData, dueDate: '' })
                          }
                        }}
                        placeholder={formData.taskType ? "Auto-calculated from task type" : "Select due date"}
                        disabled={!!formData.taskType}
                        minDate={new Date()}
                      />
                      {formData.taskType && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due date is automatically calculated from task type. Clear task type to set manually.
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="timeSpentHours">Time Spent - Hours</Label>
                        <Input
                          id="timeSpentHours"
                          type="number"
                          min="0"
                          value={formData.timeSpentHours}
                          onChange={(e) => setFormData({ ...formData, timeSpentHours: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="timeSpentMinutes">Minutes</Label>
                        <Input
                          id="timeSpentMinutes"
                          type="number"
                          min="0"
                          max="59"
                          value={formData.timeSpentMinutes}
                          onChange={(e) => {
                            const minutes = parseInt(e.target.value) || 0
                            setFormData({ ...formData, timeSpentMinutes: Math.min(59, Math.max(0, minutes)) })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks found.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {canManage && (
            <li className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all tasks"
              />
              Select all
            </li>
          )}
          {tasks.map((task) => {
            const dueToday = isOpenDueToday(task)
            const meta = [
              task.assignedTo?.name || 'Unassigned',
              canManage && task.assignedBy?.name ? `by ${task.assignedBy.name}` : '',
              task.client?.name,
              STATUS_TEXT[task.status] || task.status,
              task.priority === 'High' || task.priority === 'Urgent' ? task.priority : '',
            ].filter(Boolean).join(' · ')
            return (
              <li
                key={task.id}
                className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5 text-sm', dueToday && 'bg-amber-50')}
              >
                {canManage && (
                  <Checkbox
                    checked={selectedTasks.has(task.id)}
                    onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                    aria-label={`Select task ${task.title}`}
                  />
                )}
                <time className={cn('w-14 shrink-0 tabular-nums text-muted-foreground', dueToday && 'font-medium text-amber-800')}>
                  {dueLabel(task.dueDate, dueToday)}
                </time>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                  onClick={() => router.push(`/tasks/${task.id}`)}
                >
                  <span className="truncate font-medium">{task.title}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{meta}</span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {!canManage && task.assignedToId === session?.user?.id && (
                    <>
                      {task.status === 'Pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={isQuickUpdating === task.id}
                          onClick={async () => {
                            setIsQuickUpdating(task.id)
                            try {
                              await updateTaskStatus(task.id, { status: 'InProgress' })
                              await fetchTasks()
                              router.refresh()
                            } catch (err: any) {
                              setError(err.message || 'Failed to update task status')
                            } finally {
                              setIsQuickUpdating(null)
                            }
                          }}
                        >
                          {isQuickUpdating === task.id ? 'Saving' : 'Start'}
                        </Button>
                      )}
                      {task.status === 'InProgress' && (
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={isQuickUpdating === task.id}
                          onClick={async () => {
                            setIsQuickUpdating(task.id)
                            try {
                              await updateTaskStatus(task.id, { status: 'Approved' })
                              await fetchTasks()
                              router.refresh()
                            } catch (err: any) {
                              setError(err.message || 'Failed to update task status')
                            } finally {
                              setIsQuickUpdating(null)
                            }
                          }}
                        >
                          {isQuickUpdating === task.id ? 'Saving' : 'Done'}
                        </Button>
                      )}
                      {task.status !== 'Approved' && task.status !== 'Rejected' && (
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => handleStatusUpdate(task)}>
                          Status
                        </Button>
                      )}
                    </>
                  )}
                  {!canManage && task.assignedBy?.id === session?.user?.id && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(task)} title="Edit task">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={isDeleting === task.id}
                        onClick={() => handleDelete(task.id)}
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                  {canManage && (
                    <>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => handleStatusUpdate(task)}>
                        Status
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(task)} title="Edit task">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={isDeleting === task.id}
                        onClick={() => handleDelete(task.id)}
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

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
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="InProgress">In Progress</SelectItem>
                    {(canManage || updatingStatusTask?.assignedToId === session?.user?.id) && (
                      <SelectItem value="Approved">Done</SelectItem>
                    )}
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
              <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isUpdatingStatus}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdatingStatus}>
                {isUpdatingStatus ? 'Updating...' : 'Update'}
              </Button>
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

