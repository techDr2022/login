'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { clockIn, clockOut } from '@/app/actions/attendance-actions'
import { createEmployee } from '@/app/actions/employee-actions'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { canClockInOut } from '@/lib/rbac'
import { LogIn, LogOut, Clock, Calendar, Timer, TrendingUp, Home, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// AttendanceMode enum values (matching Prisma schema)
const AttendanceMode = {
  OFFICE: 'OFFICE',
  WFH: 'WFH',
  LEAVE: 'LEAVE',
} as const

type AttendanceModeType = typeof AttendanceMode[keyof typeof AttendanceMode]

interface AttendanceRecord {
  id: string
  userId: string
  loginTime?: string
  logoutTime?: string
  totalHours?: number
  date: string
  status: string
  mode?: string
  user?: {
    id: string
    name: string
    email: string
  }
}

export function AttendancePage() {
  const { data: session } = useSession()
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [clocking, setClocking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [selectedMode, setSelectedMode] = useState<AttendanceModeType>(AttendanceMode.OFFICE)
  const [summary, setSummary] = useState<{ officeLates: number; wfhDays: number }>({ officeLates: 0, wfhDays: 0 })
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [employeeFormData, setEmployeeFormData] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [employeeError, setEmployeeError] = useState('')
  const [isSubmittingEmployee, setIsSubmittingEmployee] = useState(false)

  const canClock = session?.user.role && canClockInOut(session.user.role as UserRole)
  const isEmployee = session?.user.role === UserRole.EMPLOYEE
  const isSuperAdmin = session?.user.role === UserRole.SUPER_ADMIN

  useEffect(() => {
    fetchAttendance()
    fetchTodayAttendance()
    if (!isEmployee) {
      fetchUsers()
    }
  }, [page, startDate, endDate, selectedUserId, isEmployee])

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmployeeError('')
    setIsSubmittingEmployee(true)

    try {
      await createEmployee({
        name: employeeFormData.name,
        email: employeeFormData.email,
        password: employeeFormData.password || undefined,
      })
      
      setEmployeeDialogOpen(false)
      setEmployeeFormData({
        name: '',
        email: '',
        password: '',
      })
      setEmployeeError('')
      // Refresh users list to include the new employee
      fetchUsers()
    } catch (err: any) {
      setEmployeeError(err.message || 'Failed to create employee')
    } finally {
      setIsSubmittingEmployee(false)
    }
  }

  const resetEmployeeForm = () => {
    setEmployeeFormData({
      name: '',
      email: '',
      password: '',
    })
    setEmployeeError('')
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users?role=EMPLOYEE')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  const fetchTodayAttendance = async () => {
    if (!canClock) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/attendance?startDate=${today}&endDate=${today}&limit=1`)
      const data = await res.json()
      if (data.attendances && data.attendances.length > 0) {
        setTodayAttendance(data.attendances[0])
      }
    } catch (err) {
      console.error('Failed to fetch today attendance:', err)
    }
  }

  const fetchAttendance = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(selectedUserId && !isEmployee && { userId: selectedUserId }),
      })
      const res = await fetch(`/api/attendance?${params}`)
      const data = await res.json()
      setAttendances(data.attendances || [])
      setTotalPages(data.pagination?.totalPages || 1)
      if (data.summary) {
        setSummary(data.summary)
      }
    } catch (err) {
      setError('Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    setClocking(true)
    setError('')
    setSuccess('')
    try {
      await clockIn(selectedMode)
      setSuccess('Clocked in successfully')
      fetchTodayAttendance()
      fetchAttendance()
    } catch (err: any) {
      setError(err.message || 'Failed to clock in')
    } finally {
      setClocking(false)
    }
  }

  const handleClockOut = async () => {
    setClocking(true)
    setError('')
    setSuccess('')
    try {
      await clockOut()
      setSuccess('Clocked out successfully')
      fetchTodayAttendance()
      fetchAttendance()
    } catch (err: any) {
      setError(err.message || 'Failed to clock out')
    } finally {
      setClocking(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Present':
        return 'default'
      case 'Late':
        return 'outline'
      case 'Absent':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-2">Track your work hours and attendance</p>
        </div>
        {isSuperAdmin && (
          <Dialog open={employeeDialogOpen} onOpenChange={(open) => {
            setEmployeeDialogOpen(open)
            if (!open) resetEmployeeForm()
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => resetEmployeeForm()} className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                New Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateEmployee}>
                <DialogHeader>
                  <DialogTitle>Create New Employee</DialogTitle>
                  <DialogDescription>
                    Add a new employee to the system. Password will be auto-generated if left empty.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {employeeError && (
                    <Alert variant="destructive">
                      <AlertDescription>{employeeError}</AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <Label htmlFor="employee-name">Name</Label>
                    <Input
                      id="employee-name"
                      value={employeeFormData.name}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, name: e.target.value })}
                      required
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="employee-email">Email</Label>
                    <Input
                      id="employee-email"
                      type="email"
                      value={employeeFormData.email}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, email: e.target.value })}
                      required
                      placeholder="john@techdr.in"
                    />
                  </div>
                  <div>
                    <Label htmlFor="employee-password">Password (Optional)</Label>
                    <Input
                      id="employee-password"
                      type="password"
                      value={employeeFormData.password}
                      onChange={(e) => setEmployeeFormData({ ...employeeFormData, password: e.target.value })}
                      placeholder="Leave empty to auto-generate"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If left empty, password will be auto-generated based on first name
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEmployeeDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmittingEmployee}>
                    {isSubmittingEmployee ? 'Creating...' : 'Create Employee'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Clock In/Out Section for Employees */}
      {canClock && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Clock In/Out</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Mark your attendance for today</p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="bg-green-50 border-green-200 text-green-800">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              {!todayAttendance?.loginTime && (
                <div className="w-[200px]">
                  <Label htmlFor="mode">Attendance Mode</Label>
                  <Select value={selectedMode} onValueChange={(value) => setSelectedMode(value as AttendanceModeType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OFFICE">Office</SelectItem>
                      <SelectItem value="WFH">Work From Home</SelectItem>
                      <SelectItem value="LEAVE">Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-4">
                {!todayAttendance?.loginTime ? (
                  <Button onClick={handleClockIn} disabled={clocking} size="lg">
                    <LogIn className="w-4 h-4 mr-2" />
                    Clock In
                  </Button>
                ) : !todayAttendance?.logoutTime ? (
                  <Button onClick={handleClockOut} disabled={clocking} size="lg" variant="destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Clock Out
                  </Button>
                ) : (
                  <div className="text-muted-foreground">You have already clocked out today</div>
                )}
              </div>
            </div>
            {todayAttendance && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Mode</p>
                    <Badge variant="outline" className="text-sm">
                      {todayAttendance.mode || 'OFFICE'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                    <Badge 
                      variant={getStatusBadgeVariant(todayAttendance.status)}
                      className={
                        todayAttendance.status === 'Late' 
                          ? 'bg-red-100 text-red-800 border-red-200' 
                          : todayAttendance.status === 'Present'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : ''
                      }
                    >
                      {todayAttendance.status}
                    </Badge>
                  </div>
                </div>
                <Separator />
                {todayAttendance.loginTime && (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Login Time</p>
                      <p className="text-base font-semibold">
                        {new Date(todayAttendance.loginTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {todayAttendance.logoutTime && (
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Logout Time</p>
                      <p className="text-base font-semibold">
                        {new Date(todayAttendance.logoutTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {todayAttendance.totalHours && (
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                      <p className="text-base font-semibold">
                        {todayAttendance.totalHours.toFixed(2)} hours
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
        {!isEmployee && (
          <div className="w-[200px]">
            <Label htmlFor="userId">Employee</Label>
            <Select value={selectedUserId || 'all'} onValueChange={(value) => {
              setSelectedUserId(value === 'all' ? '' : value)
              setPage(1)
            }}>
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
          />
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Office Lates</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.officeLates}</div>
            <p className="text-xs text-muted-foreground">Total late arrivals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WFH Days</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.wfhDays}</div>
            <p className="text-xs text-muted-foreground">Work from home days</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attendance History</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">View your attendance records</p>
            </div>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {loading && attendances.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading attendance...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
              <TableHeader>
                <TableRow>
                  {!isEmployee && <TableHead>Employee</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Login Time</TableHead>
                  <TableHead>Logout Time</TableHead>
                  <TableHead>Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isEmployee ? 6 : 7} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center py-8">
                        <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-sm font-medium text-muted-foreground">No attendance records found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  attendances.map((attendance) => (
                    <TableRow key={attendance.id} className="hover:bg-muted/50">
                      {!isEmployee && (
                        <TableCell className="font-medium">
                          {attendance.user?.name || '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground">
                        {new Date(attendance.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {attendance.mode || 'OFFICE'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(attendance.status)}
                          className={
                            attendance.status === 'Late' 
                              ? 'bg-red-100 text-red-800 border-red-200' 
                              : attendance.status === 'Present'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : ''
                          }
                        >
                          {attendance.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {attendance.loginTime
                          ? new Date(attendance.loginTime).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {attendance.logoutTime
                          ? new Date(attendance.logoutTime).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {attendance.totalHours
                          ? `${attendance.totalHours.toFixed(2)} hours`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
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
        </CardContent>
      </Card>
    </div>
  )
}

