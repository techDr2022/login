import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getManagerDashboardData } from '@/lib/dashboard-queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, CheckSquare2, Users, Clock, ArrowRight, Calendar, Plus, Briefcase } from 'lucide-react'
import Link from 'next/link'

export async function ManagerDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const data = await getManagerDashboardData(session.user.id)

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <p className="text-sm text-muted-foreground">Manager Dashboard</p>
        <h1 className="text-2xl font-semibold">Manage your team and projects</h1>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned Tasks</CardTitle>
            <CheckSquare2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalAssignedTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Total tasks assigned</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data.pendingReviews}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting your review</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Missed Deadlines</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.missedDeadlines}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Present</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.teamPresent}</div>
            <p className="text-xs text-muted-foreground mt-1">Present today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Tasks (In Progress) */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Active Tasks</CardTitle>
                <CardDescription className="text-sm">Tasks currently in progress</CardDescription>
              </div>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {!data.activeTasks || data.activeTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No active tasks</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.activeTasks || []).map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/tasks/${task.id}`}>
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {task.User_Task_assignedToIdToUser?.name || 'Unassigned'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                            {task.status}
                          </Badge>
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

        {/* Tasks Assigned Today */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Tasks Assigned Today</CardTitle>
                <CardDescription className="text-sm">Tasks you assigned today</CardDescription>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {!data.tasksAssignedToday || data.tasksAssignedToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No tasks assigned today</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.tasksAssignedToday || []).map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/tasks/${task.id}`}>
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {task.User_Task_assignedToIdToUser?.name || 'Unassigned'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              task.status === 'Approved'
                                ? 'outline'
                                : task.status === 'Rejected'
                                ? 'outline'
                                : task.status === 'Review'
                                ? 'secondary'
                                : task.status === 'InProgress'
                                ? 'secondary'
                                : 'outline'
                            }
                            className={
                              task.status === 'Approved'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : task.status === 'Rejected'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : task.status === 'InProgress'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : ''
                            }
                          >
                            {task.status}
                          </Badge>
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

        {/* Pending Approvals */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Pending Approvals</CardTitle>
                <CardDescription className="text-sm">Tasks awaiting your review</CardDescription>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.pendingApprovalsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No pending approvals</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.pendingApprovalsList.map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/tasks/${task.id}`}>
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {task.User_Task_assignedToIdToUser?.name || 'Unassigned'}
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Team Attendance */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Team Attendance</CardTitle>
                <CardDescription className="text-sm">Today&apos;s team attendance status</CardDescription>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.teamAttendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No attendance records today</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Login Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.teamAttendance.map((attendance) => (
                      <TableRow key={attendance.id}>
                        <TableCell className="font-medium">{attendance.User.name}</TableCell>
                        <TableCell>
                          <Badge variant={
                            attendance.status === 'Present' ? 'default' : 'secondary'
                          }>
                            {attendance.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {attendance.loginTime ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {new Date(attendance.loginTime).toLocaleTimeString()}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="pt-2">
                  <Link href="/attendance">
                    <Button variant="ghost" className="w-full rounded-xl">
                      View All Attendance
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Assigned Tasks (Last 7 Days) */}
      {data.recentAssignedTasks && data.recentAssignedTasks.length > 0 && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Assigned Tasks</CardTitle>
                <CardDescription className="text-sm">Tasks you assigned in the last 7 days</CardDescription>
              </div>
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentAssignedTasks.map((task) => (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/tasks/${task.id}`}>
                      <TableCell>
                        <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {task.User_Task_assignedToIdToUser?.name || 'Unassigned'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            task.status === 'Approved'
                              ? 'outline'
                              : task.status === 'Rejected'
                              ? 'outline'
                              : task.status === 'Review'
                              ? 'secondary'
                              : task.status === 'InProgress'
                              ? 'secondary'
                              : 'outline'
                          }
                          className={
                            task.status === 'Approved'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : task.status === 'Rejected'
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : task.status === 'InProgress'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : ''
                          }
                        >
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(task.createdAt).toLocaleDateString()}
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
          </CardContent>
        </Card>
      )}

      {/* Missed Deadlines Alerts */}
      {data.missedDeadlinesList.length > 0 && (
        <Card className="rounded-xl border-red-200 bg-red-50/50 dark:bg-red-950/10 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-lg text-red-600">Missed Deadlines Alerts</CardTitle>
            </div>
            <CardDescription className="text-sm">Tasks that have passed their due date</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.missedDeadlinesList.map((task) => (
                  <TableRow key={task.id} className="cursor-pointer hover:bg-red-50/50">
                    <TableCell>
                      <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.User_Task_assignedToIdToUser?.name || 'Unassigned'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-red-600" />
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString()
                          : '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{task.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

