'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  Clock, 
  User, 
  UserCheck, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Building2,
  Timer,
  MessageSquare,
  PlayCircle,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { updateTaskStatus } from '@/app/actions/task-actions'
import { useSession } from 'next-auth/react'
import { canApproveTasks } from '@/lib/rbac'
import { UserRole } from '@prisma/client'

interface TaskDetailProps {
  taskId: string
}

export function TaskDetail({ taskId }: TaskDetailProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusFormData, setStatusFormData] = useState({
    status: 'Pending' as 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected',
    rejectionFeedback: '',
  })
  const [error, setError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isQuickUpdating, setIsQuickUpdating] = useState(false)

  const canApprove = session?.user.role && canApproveTasks(session.user.role as UserRole)
  const isAssignedToMe = task && task.assignedToId === session?.user.id

  useEffect(() => {
    if (taskId) {
      fetchTask()
      
      // Poll for task updates every 5 seconds for real-time updates
      const interval = setInterval(() => {
        fetchTask()
      }, 5000) // Poll every 5 seconds

      return () => clearInterval(interval)
    } else {
      setError('Invalid task ID')
      setLoading(false)
    }
  }, [taskId])

  const fetchTask = async () => {
    if (!taskId) {
      setError('Task ID is required')
      setLoading(false)
      return
    }
    
    try {
      const res = await fetch(`/api/tasks/${taskId}?_t=${Date.now()}`, {
        cache: 'no-store', // Ensure no caching
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch task' }))
        setError(errorData.error || `Failed to load task: ${res.status} ${res.statusText}`)
        setTask(null)
        return
      }
      const data = await res.json()
      setTask(data)
      setError('')
    } catch (err) {
      console.error('Failed to fetch task:', err)
      setError('Failed to fetch task. Please try again.')
      setTask(null)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsUpdating(true)

    try {
      await updateTaskStatus(taskId, {
        status: statusFormData.status,
        rejectionFeedback: statusFormData.rejectionFeedback || undefined,
      })
      
      setStatusDialogOpen(false)
      setStatusFormData({
        status: 'Pending',
        rejectionFeedback: '',
      })
      // Immediately refresh task without waiting
      await fetchTask()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update task status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleQuickStatusUpdate = async (newStatus: 'Pending' | 'InProgress' | 'Approved') => {
    setError('')
    setIsQuickUpdating(true)
    try {
      await updateTaskStatus(taskId, {
        status: newStatus,
      })
      // Immediately refresh task without waiting
      await fetchTask()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update task status')
    } finally {
      setIsQuickUpdating(false)
    }
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

  const getPriorityBadgeClassName = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200'
      case 'High':
        return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200'
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200'
      case 'Low':
        return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading task details...</p>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Card className="rounded-xl">
          <CardContent className="p-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto" />
              <h2 className="text-2xl font-semibold">Task not found</h2>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                The task you're looking for doesn't exist or you don't have permission to view it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getStatusIcon = () => {
    switch (task.status) {
      case 'Approved':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'Rejected':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'Review':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'InProgress':
        return <PlayCircle className="h-5 w-5 text-blue-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = () => {
    switch (task.status) {
      case 'Approved':
        return 'bg-green-50 border-green-200'
      case 'Rejected':
        return 'bg-red-50 border-red-200'
      case 'Review':
        return 'bg-yellow-50 border-yellow-200'
      case 'InProgress':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{task.title}</h1>
              <Badge
                variant={getStatusBadgeVariant(task.status)}
                className={`${getStatusColor()} flex items-center gap-1.5 px-3 py-1`}
              >
                {getStatusIcon()}
                {task.status}
              </Badge>
            </div>
            {task.description && (
              <p className="text-muted-foreground text-lg max-w-3xl">{task.description}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Employee quick status updates */}
            {isAssignedToMe && !canApprove && (
              <>
                {task.status === 'Pending' && (
                  <Button 
                    onClick={() => handleQuickStatusUpdate('InProgress')}
                    disabled={isQuickUpdating}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    {isQuickUpdating ? 'Updating...' : 'Start Task'}
                  </Button>
                )}
                {task.status === 'InProgress' && (
                  <Button 
                    onClick={() => handleQuickStatusUpdate('Approved')}
                    disabled={isQuickUpdating}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {isQuickUpdating ? 'Updating...' : 'Mark Complete'}
                  </Button>
                )}
                {/* Hide Update Status button for employees when task is Approved or Rejected */}
                {task.status !== 'Approved' && task.status !== 'Rejected' && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setStatusFormData({
                        status: task.status as any,
                        rejectionFeedback: '',
                      })
                      setStatusDialogOpen(true)
                    }}
                    className="rounded-xl"
                  >
                    Update Status
                  </Button>
                )}
              </>
            )}
            {/* Admin full status update */}
            {canApprove && (
              <Button 
                onClick={() => {
                  setStatusFormData({
                    status: task.status as any,
                    rejectionFeedback: task.rejectionFeedback || '',
                  })
                  setStatusDialogOpen(true)
                }}
                className="rounded-xl"
              >
                Update Status
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Details Card */}
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Task Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Priority */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <Badge 
                    variant={getPriorityBadgeVariant(task.priority)} 
                    className={`mt-1 ${getPriorityBadgeClassName(task.priority)}`}
                  >
                    {task.priority}
                  </Badge>
                </div>
              </div>

              {/* Description */}
              {task.description && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
                  </div>
                </div>
              )}

              {/* Rejection Feedback */}
              {task.rejectionFeedback && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Rejection Feedback</p>
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive leading-relaxed">{task.rejectionFeedback}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignment & Timeline Card */}
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Assignment & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assigned To */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <User className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Assigned To</p>
                    <p className="font-semibold truncate">{task.assignedTo?.name || 'Unassigned'}</p>
                    {task.assignedTo?.email && (
                      <p className="text-xs text-muted-foreground truncate">{task.assignedTo.email}</p>
                    )}
                  </div>
                </div>

                {/* Assigned By */}
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <UserCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Assigned By</p>
                    <p className="font-semibold truncate">{task.assignedBy?.name || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Due Date */}
                {task.dueDate && (
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Due Date</p>
                      <p className="font-semibold">{new Date(task.dueDate).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}</p>
                    </div>
                  </div>
                )}

                {/* Time Spent */}
                {task.timeSpent !== undefined && task.timeSpent > 0 && (
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                    <Timer className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Time Spent</p>
                      <p className="font-semibold">
                        {(() => {
                          const totalHours = task.timeSpent
                          const hours = Math.floor(totalHours)
                          const minutes = Math.round((totalHours - hours) * 60)
                          if (hours > 0 && minutes > 0) {
                            return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`
                          } else if (hours > 0) {
                            return `${hours} hour${hours !== 1 ? 's' : ''}`
                          } else if (minutes > 0) {
                            return `${minutes} minute${minutes !== 1 ? 's' : ''}`
                          }
                          return '0 hours'
                        })()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Related Information Card */}
          <Card className="rounded-xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Related Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.client && (
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Client</p>
                    <Link 
                      href={`/clients/${task.client.id}`} 
                      className="font-semibold text-primary hover:underline truncate block"
                    >
                      {task.client.name}
                    </Link>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Created At</p>
                  <p className="font-semibold text-sm">
                    {new Date(task.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(task.createdAt).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={(open) => {
        setStatusDialogOpen(open)
        if (!open) {
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
                    {canApprove && (
                      <>
                        <SelectItem value="Review">Review</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </>
                    )}
                    {isAssignedToMe && !canApprove && (
                      <>
                        <SelectItem value="Approved">Approved (Completed)</SelectItem>
                      </>
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
              <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Updating...' : 'Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

