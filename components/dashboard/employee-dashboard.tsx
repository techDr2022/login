'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckSquare2, Clock, Calendar, TrendingUp, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { TaskStatusTimeline } from './task-status-timeline'
import { updateTaskStatus } from '@/app/actions/task-actions'

interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  client?: {
    id: string
    name: string
  }
  assignedTo?: {
    id: string
    name: string | null
    email?: string | null
  } | null
  assignedBy?: {
    id: string
    name: string | null
    email?: string | null
  } | null
}

interface AttendanceSummary {
  todayStatus?: string
  todayMode?: string
  loginTime?: string
  logoutTime?: string
  totalHours?: number
  thisMonthPresent: number
  thisMonthLate: number
  thisMonthAbsent: number
}

export function EmployeeDashboard() {
  const { data: session } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [pendingAssignedByMeTasks, setPendingAssignedByMeTasks] = useState<Task[]>([])
  const [todaysTasks, setTodaysTasks] = useState<Task[]>([])
  const [assignedByMeTasks, setAssignedByMeTasks] = useState<Task[]>([])
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set())
  const [startingTasks, setStartingTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) return
      
      try {
        const today = new Date().toISOString().split('T')[0]
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
        const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
        const userId = session.user.id

        // Get today's date range (start and end of today)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        // Fetch all data in parallel for better performance
        const [tasksRes, allTasksRes, todaysTasksRes, assignedByMeRes, attendanceRes, monthRes] = await Promise.all([
          fetch(`/api/tasks?assignedToId=${userId}&limit=5`),
          fetch(`/api/tasks?assignedToId=${userId}&limit=50`), // Fetch more to get all pending/in-progress
          fetch(`/api/tasks?assignedToId=${userId}&limit=10`),
          fetch(`/api/tasks?assignedById=${userId}&limit=5`),
          fetch(`/api/attendance?userId=${userId}&startDate=${today}&endDate=${today}`),
          fetch(`/api/attendance?userId=${userId}&startDate=${firstDayOfMonth}&endDate=${lastDayOfMonth}`),
        ])

        const [tasksData, allTasksData, todaysTasksData, assignedByMeData, attendanceData, monthData] = await Promise.all([
          tasksRes.json(),
          allTasksRes.json(),
          todaysTasksRes.json(),
          assignedByMeRes.json(),
          attendanceRes.json(),
          monthRes.json(),
        ])

        // Filter pending tasks assigned to me (Pending or InProgress status)
        const pending = (allTasksData.tasks || []).filter((task: Task) =>
          (task.status === 'Pending' || task.status === 'InProgress') &&
          task.assignedTo?.id === userId
        )

        // Filter pending tasks assigned by me (Pending or InProgress status)
        const pendingAssignedByMe = (assignedByMeData.tasks || []).filter((task: Task) =>
          (task.status === 'Pending' || task.status === 'InProgress') &&
          task.assignedBy?.id === userId
        )

        // Filter tasks that are due today
        const todayTasks = (todaysTasksData.tasks || []).filter((task: Task) => {
          if (!task.dueDate) return false
          const dueDate = new Date(task.dueDate)
          return dueDate >= todayStart && dueDate <= todayEnd
        })

        setTasks(tasksData.tasks?.slice(0, 5) || [])
        setPendingTasks(pending.slice(0, 10))
        setPendingAssignedByMeTasks(pendingAssignedByMe.slice(0, 10))
        setTodaysTasks(todayTasks.slice(0, 5))
        setAssignedByMeTasks(assignedByMeData.tasks?.slice(0, 5) || [])

        const todayAttendance = attendanceData.attendances?.[0]
        const monthAttendances = monthData.attendances || []
        const presentCount = monthAttendances.filter((a: any) => a.status === 'Present').length
        const lateCount = monthAttendances.filter((a: any) => a.status === 'Late').length
        const absentCount = monthAttendances.filter((a: any) => a.status === 'Absent').length

        setAttendanceSummary({
          todayStatus: todayAttendance?.status,
          todayMode: todayAttendance?.mode,
          loginTime: todayAttendance?.loginTime,
          logoutTime: todayAttendance?.logoutTime,
          totalHours: todayAttendance?.totalHours,
          thisMonthPresent: presentCount,
          thisMonthLate: lateCount,
          thisMonthAbsent: absentCount,
        })
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session?.user?.id])

  const handleMarkComplete = async (taskId: string) => {
    setCompletingTasks(prev => new Set(prev).add(taskId))
    try {
      await updateTaskStatus(taskId, { status: 'Approved' })
      // Remove the completed task from pending tasks
      setPendingTasks(prev => prev.filter(task => task.id !== taskId))
      // Also update in other task lists
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: 'Approved' } : task
      ))
      setTodaysTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: 'Approved' } : task
      ))
    } catch (error) {
      console.error('Failed to mark task as complete:', error)
      alert('Failed to mark task as complete. Please try again.')
    } finally {
      setCompletingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  const handleStartTask = async (taskId: string) => {
    setStartingTasks(prev => new Set(prev).add(taskId))
    try {
      await updateTaskStatus(taskId, { status: 'InProgress' })
      // Update status in local task lists
      const updateStatus = (tasks: Task[]) =>
        tasks.map(task => (task.id === taskId ? { ...task, status: 'InProgress' } : task))

      setPendingTasks(prev => updateStatus(prev))
      setTasks(prev => updateStatus(prev))
      setTodaysTasks(prev => updateStatus(prev))
    } catch (error) {
      console.error('Failed to start task:', error)
      alert('Failed to start task. Please try again.')
    } finally {
      setStartingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Urgent':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Urgent</Badge>
      case 'High':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">High</Badge>
      case 'Medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium</Badge>
      case 'Low':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Low</Badge>
      default:
        return <Badge variant="outline">{priority}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
      case 'Review':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Review</Badge>
      case 'InProgress':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">In Progress</Badge>
      case 'Pending':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Pending</Badge>
      case 'Rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <p className="text-sm text-muted-foreground">Employee Dashboard</p>
        <h1 className="text-2xl font-semibold">Welcome back, {session?.user?.name || 'Employee'}</h1>
      </div>

      {/* Your Pending Tasks - Highlighted Section */}
      {(pendingTasks.length > 0 || pendingAssignedByMeTasks.length > 0) && (
        <Card className="rounded-xl border-2 border-blue-500 shadow-lg bg-gradient-to-br from-blue-50 to-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-blue-900 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  Your Pending Tasks
                </CardTitle>
                <CardDescription className="text-sm text-blue-700">
                  {pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''} assigned to you,&nbsp;
                  {pendingAssignedByMeTasks.length} task{pendingAssignedByMeTasks.length !== 1 ? 's' : ''} assigned by you
                </CardDescription>
              </div>
              <CheckSquare2 className="h-6 w-6 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pending tasks assigned to me */}
              <div className="space-y-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-900">Assigned to you</p>
                  <span className="text-xs text-blue-700">
                    {pendingTasks.length} pending
                  </span>
                </div>
                {pendingTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending tasks assigned to you.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {pendingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-4 p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/tasks/${task.id}`}
                                className="font-semibold text-gray-900 hover:text-blue-600 hover:underline"
                              >
                                {task.title}
                              </Link>
                              {getPriorityBadge(task.priority)}
                            </div>
                            <div className="shrink-0">
                              {getStatusBadge(task.status)}
                            </div>
                          </div>
                          {task.client && (
                            <p className="text-sm text-muted-foreground mb-1">{task.client.name}</p>
                          )}
                          {(task.assignedBy || task.assignedTo) && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {task.assignedBy && (
                                <>Assigned by: <span className="font-medium">{task.assignedBy.name || 'Unknown'}</span></>
                              )}
                              {task.assignedBy && task.assignedTo && ' · '}
                              {task.assignedTo && (
                                <>Assigned to: <span className="font-medium">{task.assignedTo.name || 'Unknown'}</span></>
                              )}
                            </p>
                          )}
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground mb-3">
                              Due: {format(new Date(task.dueDate), 'MMM dd, hh:mm a')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {task.status === 'Pending' && (
                            <Button
                              onClick={() => handleStartTask(task.id)}
                              disabled={startingTasks.has(task.id)}
                              variant="outline"
                              size="sm"
                            >
                              {startingTasks.has(task.id) ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                  Starting...
                                </>
                              ) : (
                                <>
                                  Start
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            onClick={() => handleMarkComplete(task.id)}
                            disabled={completingTasks.has(task.id)}
                            className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                            size="sm"
                          >
                            {completingTasks.has(task.id) ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Completing...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Complete
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending tasks assigned by me */}
              <div className="space-y-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-900">Assigned by you</p>
                  <span className="text-xs text-blue-700">
                    {pendingAssignedByMeTasks.length} pending
                  </span>
                </div>
                {pendingAssignedByMeTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending tasks assigned by you.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {pendingAssignedByMeTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex flex-col p-4 bg-white rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/tasks/${task.id}`}
                                className="font-semibold text-gray-900 hover:text-blue-600 hover:underline"
                              >
                                {task.title}
                              </Link>
                              {getPriorityBadge(task.priority)}
                            </div>
                            <div className="shrink-0">
                              {getStatusBadge(task.status)}
                            </div>
                          </div>
                          {task.client && (
                            <p className="text-sm text-muted-foreground mb-1">{task.client.name}</p>
                          )}
                          {(task.assignedBy || task.assignedTo) && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {task.assignedBy && (
                                <>Assigned by: <span className="font-medium">{task.assignedBy.name || 'Unknown'}</span></>
                              )}
                              {task.assignedBy && task.assignedTo && ' · '}
                              {task.assignedTo && (
                                <>Assigned to: <span className="font-medium">{task.assignedTo.name || 'Unknown'}</span></>
                              )}
                            </p>
                          )}
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(task.dueDate), 'MMM dd, hh:mm a')}
                            </p>
                          )}
                        </div>
                        {/* No action button here since these tasks are for others */}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="pt-4">
              <Link href="/tasks">
                <Button variant="outline" className="w-full rounded-xl border-blue-300 text-blue-700 hover:bg-blue-50">
                  View All Tasks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Status</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceSummary?.todayStatus ? (
                <Badge className={
                  attendanceSummary.todayStatus === 'Present' ? 'bg-green-100 text-green-800 border-green-200' :
                  attendanceSummary.todayStatus === 'Late' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                  'bg-red-100 text-red-800 border-red-200'
                }>
                  {attendanceSummary.todayStatus}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Not clocked in</span>
              )}
            </div>
            {attendanceSummary?.todayMode && (
              <p className="text-xs text-muted-foreground mt-1">Mode: {attendanceSummary.todayMode}</p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month - Present</CardTitle>
            <CheckSquare2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{attendanceSummary?.thisMonthPresent || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Days present</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month - Late</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{attendanceSummary?.thisMonthLate || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Late arrivals</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">My Tasks</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Assigned to me</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Tasks */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Today&apos;s Tasks</CardTitle>
                <CardDescription className="text-sm">Tasks due today</CardDescription>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {todaysTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No tasks due today</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaysTasks.map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                          {task.client && (
                            <p className="text-xs text-muted-foreground">{task.client.name}</p>
                          )}
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground">
                              Due: {format(new Date(task.dueDate), 'MMM dd, hh:mm a')}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="pt-2">
                  <Link href="/tasks">
                    <Button variant="ghost" className="w-full rounded-xl">
                      View All Tasks
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Tasks */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">My Tasks</CardTitle>
                <CardDescription className="text-sm">Tasks assigned to me</CardDescription>
              </div>
              <CheckSquare2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No tasks assigned</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                          {task.client && (
                            <p className="text-xs text-muted-foreground">{task.client.name}</p>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="pt-2">
                  <Link href="/tasks">
                    <Button variant="ghost" className="w-full rounded-xl">
                      View All Tasks
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned by Me */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Assigned by Me</CardTitle>
                <CardDescription className="text-sm">Tasks I assigned to others</CardDescription>
              </div>
              <CheckSquare2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {assignedByMeTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No tasks assigned by you</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedByMeTasks.map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                          {task.client && (
                            <p className="text-xs text-muted-foreground">{task.client.name}</p>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="pt-2">
                  <Link href="/tasks?assignedByMe=true">
                    <Button variant="ghost" className="w-full rounded-xl">
                      View All Tasks
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Attendance */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Today's Attendance</CardTitle>
                <CardDescription className="text-sm">Your attendance for today</CardDescription>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {!attendanceSummary?.loginTime ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">Not clocked in today</p>
                <Link href="/attendance" className="mt-4">
                  <Button>Go to Attendance</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge className={
                      attendanceSummary.todayStatus === 'Present' ? 'bg-green-100 text-green-800 border-green-200' :
                      attendanceSummary.todayStatus === 'Late' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-red-100 text-red-800 border-red-200'
                    }>
                      {attendanceSummary.todayStatus}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Mode:</span>
                    <Badge variant="outline">{attendanceSummary.todayMode}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Check-in:</span>
                    <span className="text-sm font-medium">
                      {attendanceSummary.loginTime ? format(new Date(attendanceSummary.loginTime), 'hh:mm a') : '-'}
                    </span>
                  </div>
                  {attendanceSummary.logoutTime && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Check-out:</span>
                      <span className="text-sm font-medium">
                        {format(new Date(attendanceSummary.logoutTime), 'hh:mm a')}
                      </span>
                    </div>
                  )}
                  {attendanceSummary.totalHours && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Hours:</span>
                      <span className="text-sm font-medium">
                        {attendanceSummary.totalHours.toFixed(2)} hrs
                      </span>
                    </div>
                  )}
                </div>
                <Link href="/attendance">
                  <Button variant="ghost" className="w-full rounded-xl">
                    View Full Attendance
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Status Timeline */}
      <TaskStatusTimeline />
    </div>
  )
}

