'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckSquare2, Clock, Calendar, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { TaskStatusTimeline } from './task-status-timeline'

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
  const [assignedByMeTasks, setAssignedByMeTasks] = useState<Task[]>([])
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user?.id) return
      
      try {
        const today = new Date().toISOString().split('T')[0]
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
        const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
        const userId = session.user.id

        // Fetch all data in parallel for better performance
        const [tasksRes, assignedByMeRes, attendanceRes, monthRes] = await Promise.all([
          fetch(`/api/tasks?assignedToId=${userId}&limit=5`),
          fetch(`/api/tasks?assignedById=${userId}&limit=5`),
          fetch(`/api/attendance?userId=${userId}&startDate=${today}&endDate=${today}`),
          fetch(`/api/attendance?userId=${userId}&startDate=${firstDayOfMonth}&endDate=${lastDayOfMonth}`),
        ])

        const [tasksData, assignedByMeData, attendanceData, monthData] = await Promise.all([
          tasksRes.json(),
          assignedByMeRes.json(),
          attendanceRes.json(),
          monthRes.json(),
        ])

        setTasks(tasksData.tasks?.slice(0, 5) || [])
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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High':
        return <Badge className="bg-red-100 text-red-800 border-red-200">High</Badge>
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

