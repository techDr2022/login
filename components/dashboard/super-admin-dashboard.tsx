import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSuperAdminDashboardData } from '@/lib/dashboard-queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Users, CheckSquare2, Clock, AlertCircle, Briefcase, ArrowRight, Calendar, TrendingUp, Plus } from 'lucide-react'
import Link from 'next/link'
import { TaskStatusTimeline } from './task-status-timeline'

export async function SuperAdminDashboard() {
  const session = await getServerSession(authOptions)
  const data = await getSuperAdminDashboardData(session?.user?.id)

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <p className="text-sm text-muted-foreground">Super Admin Dashboard</p>
        <h1 className="text-2xl font-semibold">Overview of your organization</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Logged In Today</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.loggedInToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Active users</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.tasksCompletedToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed today</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Late Logins</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data.lateLogins}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            <Briefcase className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{data.totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">All clients</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Tasks */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Tasks</CardTitle>
                <CardDescription className="text-sm">Tasks assigned by admin</CardDescription>
              </div>
              <CheckSquare2 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No recent tasks</p>
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
                    {data.recentTasks.map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {task.User_Task_assignedToIdToUser?.name || 'Unassigned'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.status}</Badge>
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

        {/* Team Attendance Overview */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Team Attendance</CardTitle>
                <CardDescription className="text-sm">Today&apos;s attendance overview</CardDescription>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.teamAttendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No attendance data</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.teamAttendance.map((item) => (
                  <div key={item.status} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        item.status === 'Present' ? 'bg-green-500' : 
                        item.status === 'Absent' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="font-medium">{item.status}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {item._count.status}
                    </Badge>
                  </div>
                ))}
                <Separator />
                <Link href="/attendance">
                  <Button variant="ghost" className="w-full rounded-xl">
                    View All Attendance
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
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
            {data.assignedByMeTasks.length === 0 ? (
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
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assignedByMeTasks.map((task) => (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link href={`/tasks/${task.id}`} className="font-medium hover:underline">
                            {task.title}
                          </Link>
                          {task.Client && (
                            <p className="text-xs text-muted-foreground">{task.Client.name}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {task.User_Task_assignedToIdToUser?.name || 'Unassigned'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.status}</Badge>
                        </TableCell>
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
      </div>

      {/* Client Workload */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Client Workload</CardTitle>
              <CardDescription className="text-sm">Overview of client tasks</CardDescription>
            </div>
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {data.clientWorkload.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">No client data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Tasks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.clientWorkload.map((client) => (
                    <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                          {client.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{client._count.Task}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="pt-2">
                <Link href="/clients">
                  <Button variant="ghost" className="w-full rounded-xl">
                    View All Clients
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Status Timeline */}
      <TaskStatusTimeline />
    </div>
  )
}

