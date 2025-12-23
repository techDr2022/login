import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEmployeeDashboardData } from '@/lib/dashboard-queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckSquare2, Clock, Circle, ArrowRight, Calendar, Timer, TrendingUp, Plus, Briefcase, Activity } from 'lucide-react'
import Link from 'next/link'

export async function EmployeeDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const data = await getEmployeeDashboardData(session.user.id)

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h1 className="text-2xl font-semibold">{session.user.name}</h1>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/tasks?create=true">
          <Button className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            <CheckSquare2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.myTasksTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">All assigned tasks</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.myTasksCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks finished</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data.myTasksPending}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            <Circle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.myTasksInProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently working</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* My Active Tasks */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">My Active Tasks</CardTitle>
                <CardDescription className="text-sm">Tasks that require your attention</CardDescription>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.myActiveTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No active tasks</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm">Title</TableHead>
                      <TableHead className="text-sm">Due Date</TableHead>
                      <TableHead className="text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.myActiveTasks.map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline text-sm">
                            {task.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {task.dueDate ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{task.status}</Badge>
                        </TableCell>
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

        {/* Today Attendance Status */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Today's Attendance</CardTitle>
                <CardDescription className="text-sm">Your attendance status for today</CardDescription>
              </div>
              <Timer className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.todayAttendance ? (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Status</p>
                  <Badge className="text-sm rounded-xl" variant={
                    data.todayAttendance.status === 'Present' ? 'default' : 'secondary'
                  }>
                    {data.todayAttendance.status}
                  </Badge>
                </div>
                <Separator />
                {data.todayAttendance.loginTime && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Login Time</p>
                    <p className="text-lg font-semibold">
                      {new Date(data.todayAttendance.loginTime).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                {data.todayAttendance.logoutTime && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Logout Time</p>
                    <p className="text-lg font-semibold">
                      {new Date(data.todayAttendance.logoutTime).toLocaleTimeString()}
                    </p>
                  </div>
                )}
                {data.todayAttendance.totalHours && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Hours</p>
                    <p className="text-lg font-semibold">
                      {data.todayAttendance.totalHours.toFixed(2)} hours
                    </p>
                  </div>
                )}
                <Separator />
                <Link href="/attendance">
                  <Button variant="outline" className="w-full rounded-xl">
                    View Attendance History
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground mb-4">No attendance record for today</p>
                <Link href="/attendance">
                  <Button variant="outline" className="rounded-xl">Mark Attendance</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

