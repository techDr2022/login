'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Edit, Trash2, TrendingUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { updateTaskStatus } from '@/app/actions/task-actions'
import { useSession } from 'next-auth/react'
import { canManageTasks, canApproveTasks } from '@/lib/rbac'
import { UserRole } from '@prisma/client'
import { useRouter } from 'next/navigation'

// Lazy load recharts to reduce initial bundle size
const RechartsChart = dynamic(
  () => import('recharts').then((mod) => {
    const { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } = mod
    return ({ chartData }: { chartData: any[] }) => (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="completed"
            stroke="#10b981"
            strokeWidth={2}
            name="Completed"
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Total"
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }),
  { 
    ssr: false,
    loading: () => <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
  }
)

interface Employee {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  joiningDate: string | null
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  performanceScore: number
}

interface EmployeeDetailDrawerProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (employee: Employee) => void
  onDelete: () => void
}

interface EmployeeDetails {
  employee: any
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  performanceScore: number
  completionRate: number
  recentTasks: any[]
  last7DaysTasks: any[]
  attendances: any[]
}

export function EmployeeDetailDrawer({
  employee,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EmployeeDetailDrawerProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [details, setDetails] = useState<EmployeeDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [updatingStatusTask, setUpdatingStatusTask] = useState<any>(null)
  const [statusFormData, setStatusFormData] = useState({
    status: 'Pending' as 'Pending' | 'InProgress' | 'Review' | 'Approved' | 'Rejected',
    rejectionFeedback: '',
  })
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [error, setError] = useState('')

  const canManage = session?.user.role && canManageTasks(session.user.role as UserRole)
  const canApprove = session?.user.role && canApproveTasks(session.user.role as UserRole)

  useEffect(() => {
    if (employee && open) {
      fetchEmployeeDetails()
    }
  }, [employee, open])

  const fetchEmployeeDetails = async () => {
    if (!employee) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}`)
      const data = await res.json()
      // API returns { employee: {...} }, so we need to extract the employee data
      if (data.employee) {
        setDetails({
          employee: data.employee,
          totalTasks: data.employee.totalTasks || 0,
          completedTasks: data.employee.completedTasks || 0,
          pendingTasks: data.employee.pendingTasks || 0,
          overdueTasks: data.employee.overdueTasks || 0,
          performanceScore: data.employee.performanceScore || 0,
          completionRate: data.employee.completionRate || 0,
          recentTasks: data.employee.recentTasks || [],
          last7DaysTasks: data.employee.last7DaysTasks || [],
          attendances: data.employee.attendances || [],
        })
      }
    } catch (error) {
      console.error('Failed to fetch employee details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Prepare chart data for performance trend
  const chartData = details?.last7DaysTasks && Array.isArray(details.last7DaysTasks)
    ? details.last7DaysTasks.reduce((acc: any[], task: any) => {
        const date = new Date(task.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        const existing = acc.find((item) => item.date === date)
        if (existing) {
          existing.completed += task.status === 'Approved' ? 1 : 0
          existing.total += 1
        } else {
          acc.push({
            date,
            completed: task.status === 'Approved' ? 1 : 0,
            total: 1,
          })
        }
        return acc
      }, [])
    : []

  const handleReactivate = async () => {
    if (!employee) return

    try {
      const res = await fetch(`/api/admin/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      
      if (res.ok) {
        alert('Employee reactivated successfully')
        onOpenChange(false)
        // Refresh the employee list
        window.location.reload()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to reactivate employee')
      }
    } catch (error) {
      console.error('Failed to reactivate employee:', error)
      alert('Failed to reactivate employee')
    }
  }

  const handleDelete = async () => {
    if (!employee) return

    try {
      // If employee is inactive, permanently delete them; otherwise just deactivate
      const hardDelete = !employee.isActive
      const url = `/api/admin/employees/${employee.id}${hardDelete ? '?hard=true' : ''}`
      const res = await fetch(url, {
        method: 'DELETE',
      })
      if (res.ok) {
        onDelete()
        onOpenChange(false)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete employee')
      }
    } catch (error) {
      console.error('Failed to delete employee:', error)
      alert('Failed to delete employee')
    }
  }

  const handleStatusUpdate = (task: any) => {
    setUpdatingStatusTask(task)
    setStatusFormData({
      status: task.status as any,
      rejectionFeedback: task.rejectionFeedback || '',
    })
    setStatusDialogOpen(true)
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
      // Refresh employee details to show updated task status
      await fetchEmployeeDetails()
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update task status')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (!employee) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {getInitials(employee.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-2xl">{employee.name}</SheetTitle>
              <SheetDescription>{employee.email}</SheetDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(employee)
                  onOpenChange(false)
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {!employee.isActive && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleReactivate}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Reactivate
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to ${employee.isActive ? 'deactivate' : 'delete'} this employee?`)) {
                    handleDelete()
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {employee.isActive ? 'Deactivate' : 'Delete'}
              </Button>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : details ? (
          <div className="mt-6 space-y-6">
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Performance Score</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-3xl font-bold ${getPerformanceColor(details.performanceScore)}`}
                      >
                        {details.performanceScore}
                      </span>
                      <span className="text-muted-foreground">/100</span>
                    </div>
                    <Progress value={details.performanceScore} className="mt-2" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-3xl font-bold text-blue-600">
                        {details.completionRate}%
                      </span>
                    </div>
                    <Progress value={details.completionRate} className="mt-2" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tasks</p>
                    <p className="text-2xl font-bold">{details.totalTasks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">
                      {details.completedTasks}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {details.pendingTasks}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">
                      {details.overdueTasks}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Tasks (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!details.recentTasks || details.recentTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No tasks in the last 30 days
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {details.recentTasks.slice(0, 10).map((task: any) => {
                          // For employees: hide update button if task is Approved or Rejected
                          // For admins: always show update button
                          const shouldShowUpdateButton = canManage || 
                            (task.status !== 'Approved' && task.status !== 'Rejected')
                          
                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 rounded-lg border"
                            >
                              <div className="flex-1">
                                <p className="font-medium">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="outline"
                                    className={
                                      task.status === 'Approved' ? 'bg-green-100 text-green-800 border-green-200' :
                                      task.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                                      ''
                                    }
                                  >
                                    {task.status}
                                  </Badge>
                                  <Badge 
                                    variant="outline"
                                    className={
                                      task.priority === 'Urgent' ? 'bg-red-100 text-red-800 border-red-200' :
                                      task.priority === 'High' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                      task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                      task.priority === 'Low' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                      ''
                                    }
                                  >
                                    {task.priority}
                                  </Badge>
                                  {task.Client && (
                                    <span className="text-xs text-muted-foreground">
                                      {task.Client.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                {task.dueDate && (
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(task.dueDate).toLocaleDateString()}
                                  </p>
                                )}
                                {shouldShowUpdateButton && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStatusUpdate(task)
                                    }}
                                    className="h-7 text-xs"
                                  >
                                    Update Status
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Trend (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <RechartsChart chartData={chartData} />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No performance data available
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attendance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Attendance (Last 30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {details.attendances && details.attendances.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Hours</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {details.attendances.map((attendance: any) => (
                            <TableRow key={attendance.id}>
                              <TableCell>
                                {new Date(attendance.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{attendance.status}</Badge>
                              </TableCell>
                              <TableCell>
                                {attendance.totalHours
                                  ? `${attendance.totalHours.toFixed(1)}h`
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No attendance data available
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Admin Notes */}
            {details.employee?.adminNotes && (
              <Card>
                <CardHeader>
                  <CardTitle>Admin Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {details.employee.adminNotes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}

        {/* Status Update Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={(open) => {
          setStatusDialogOpen(open)
          if (!open) {
            setUpdatingStatusTask(null)
            setStatusFormData({ status: 'Pending', rejectionFeedback: '' })
            setError('')
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
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}
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
      </SheetContent>
    </Sheet>
  )
}

