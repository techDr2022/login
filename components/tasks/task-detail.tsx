'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
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

  const canApprove = session?.user.role && canApproveTasks(session.user.role as UserRole)
  const isEmployee = session?.user.role === UserRole.EMPLOYEE
  const isAssignedToMe = task && task.assignedToId === session?.user.id

  useEffect(() => {
    if (taskId) {
      fetchTask()
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
      const res = await fetch(`/api/tasks/${taskId}`)
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
      fetchTask()
    } catch (err: any) {
      setError(err.message || 'Failed to update task status')
    }
  }

  const handleQuickStatusUpdate = async (newStatus: 'Pending' | 'InProgress' | 'Review') => {
    setError('')
    try {
      await updateTaskStatus(taskId, {
        status: newStatus,
      })
      fetchTask()
    } catch (err: any) {
      setError(err.message || 'Failed to update task status')
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

  if (loading) return <div>Loading...</div>
  if (!task) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Task not found</h2>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <p className="text-sm text-gray-500">
                The task you're looking for doesn't exist or you don't have permission to view it.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">{task.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Employee quick actions */}
          {isEmployee && isAssignedToMe && task.status !== 'Approved' && task.status !== 'Rejected' && (
            <>
              {task.status === 'Pending' && (
                <Button onClick={() => handleQuickStatusUpdate('InProgress')} className="bg-blue-600 hover:bg-blue-700">
                  Start Task
                </Button>
              )}
              {task.status === 'InProgress' && (
                <Button onClick={() => handleQuickStatusUpdate('Review')} className="bg-green-600 hover:bg-green-700">
                  Mark as Complete
                </Button>
              )}
              {task.status === 'Review' && (
                <Button variant="outline" disabled>
                  Awaiting Review
                </Button>
              )}
            </>
          )}
          {/* Manager/Admin full status update */}
          {canApprove && (
            <Button onClick={() => {
              setStatusFormData({
                status: task.status as any,
                rejectionFeedback: task.rejectionFeedback || '',
              })
              setStatusDialogOpen(true)
            }}>
              Update Status
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge
                variant={getStatusBadgeVariant(task.status)}
                className={
                  task.status === 'Approved'
                    ? 'mt-1 bg-green-100 text-green-800 border-green-200'
                    : task.status === 'Rejected'
                    ? 'mt-1 bg-red-100 text-red-800 border-red-200'
                    : 'mt-1'
                }
              >
                {task.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Priority</p>
              <Badge variant={getPriorityBadgeVariant(task.priority)} className="mt-1">
                {task.priority}
              </Badge>
            </div>
            {task.description && (
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium mt-1">{task.description}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Assigned To</p>
              <p className="font-medium">{task.assignedTo?.name || 'Unassigned'}</p>
              {task.assignedTo?.email && (
                <p className="text-sm text-gray-500">{task.assignedTo.email}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned By</p>
              <p className="font-medium">{task.assignedBy?.name || '-'}</p>
            </div>
            {task.dueDate && (
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium">{new Date(task.dueDate).toLocaleDateString()}</p>
              </div>
            )}
            {task.timeSpent !== undefined && (
              <div>
                <p className="text-sm text-gray-500">Time Spent</p>
                <p className="font-medium">{task.timeSpent} hours</p>
              </div>
            )}
            {task.rejectionFeedback && (
              <div>
                <p className="text-sm text-gray-500">Rejection Feedback</p>
                <p className="font-medium text-red-600">{task.rejectionFeedback}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Related Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.client && (
              <div>
                <p className="text-sm text-gray-500">Client</p>
                <Link href={`/clients/${task.client.id}`} className="text-blue-600 hover:underline font-medium">
                  {task.client.name}
                </Link>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Created At</p>
              <p className="font-medium">{new Date(task.createdAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="InProgress">In Progress</SelectItem>
                    <SelectItem value="Review">Review</SelectItem>
                    {canApprove && (
                      <>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
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
              <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

