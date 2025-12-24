'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle2, 
  XCircle,
  Home,
  Flag,
  BarChart3,
  Download
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'

interface TeamMember {
  id: string
  name: string
  email: string
  checkIn?: string | null
  status: string
  lateCount: number
  isWFH: boolean
  tasksDone: number
  mode?: string
}

interface TeamAttendanceRecord {
  id: string
  userId: string
  date: string
  loginTime?: string | null
  logoutTime?: string | null
  status: string
  mode: string
  lateSignInMinutes?: number | null
  user?: {
    id: string
    name: string
    email: string
  }
}

interface MonthlyData {
  [userId: string]: {
    name: string
    records: TeamAttendanceRecord[]
  }
}

export function ManagerAttendancePage() {
  const { data: session } = useSession()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({})
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({
    teamSize: 0,
    presentToday: 0,
    lateToday: 0,
    wfhToday: 0,
    absentToday: 0,
  })
  const [flags, setFlags] = useState<Array<{
    type: string
    employeeId: string
    employeeName: string
    message: string
    severity: 'warning' | 'error'
  }>>([])
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<TeamAttendanceRecord | null>(null)
  const [correctionReason, setCorrectionReason] = useState('')

  // Fetch team attendance
  const fetchTeamAttendance = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/attendance?startDate=${today}&endDate=${today}&limit=100`)
      const data = await res.json()
      
      // Fetch all employees
      const employeesRes = await fetch('/api/users?role=EMPLOYEE')
      const employeesData = await employeesRes.json()
      const employees = employeesData.users || []
      
      // Fetch tasks for each employee
      const tasksRes = await fetch('/api/tasks?limit=1000')
      const tasksData = await tasksRes.json()
      const tasks = tasksData.tasks || []
      
      // Build team members list
      const members: TeamMember[] = employees.map((emp: any) => {
        const todayAttendance = data.attendances?.find((a: TeamAttendanceRecord) => a.userId === emp.id)
        const employeeTasks = tasks.filter((t: any) => t.assignedToId === emp.id)
        const completedTasks = employeeTasks.filter((t: any) => t.status === 'Approved').length
        
        // Calculate late count for this month
        const monthStart = startOfMonth(new Date()).toISOString().split('T')[0]
        const monthEnd = endOfMonth(new Date()).toISOString().split('T')[0]
        // This would need a separate API call for monthly data
        
        return {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          checkIn: todayAttendance?.loginTime || null,
          status: todayAttendance?.status || 'Absent',
          lateCount: 0, // Will be calculated from monthly data
          isWFH: todayAttendance?.mode === 'WFH',
          tasksDone: completedTasks,
          mode: todayAttendance?.mode,
        }
      })
      
      setTeamMembers(members)
      
      // Calculate summary
      setSummary({
        teamSize: employees.length,
        presentToday: data.attendances?.filter((a: TeamAttendanceRecord) => a.status === 'Present').length || 0,
        lateToday: data.attendances?.filter((a: TeamAttendanceRecord) => a.status === 'Late').length || 0,
        wfhToday: data.attendances?.filter((a: TeamAttendanceRecord) => a.mode === 'WFH').length || 0,
        absentToday: employees.length - (data.attendances?.length || 0),
      })
      
      // Generate flags
      const newFlags: typeof flags = []
      data.attendances?.forEach((att: TeamAttendanceRecord) => {
        // Repeated late (would need monthly data)
        // Inactive WFH
        if (att.mode === 'WFH' && !att.logoutTime) {
          // Check if last activity was > 2 hours ago
          // This would need WFH activity data
        }
        // Missed checkout
        if (att.loginTime && !att.logoutTime && new Date(att.loginTime).getHours() < 19) {
          const hoursSinceLogin = (new Date().getTime() - new Date(att.loginTime).getTime()) / (1000 * 60 * 60)
          if (hoursSinceLogin > 9) {
            newFlags.push({
              type: 'missed_checkout',
              employeeId: att.userId,
              employeeName: att.user?.name || 'Unknown',
              message: 'Missed checkout - logged in but not logged out',
              severity: 'warning',
            })
          }
        }
      })
      
      setFlags(newFlags)
    } catch (err) {
      console.error('Failed to fetch team attendance:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch monthly calendar data
  const fetchMonthlyData = useCallback(async () => {
    try {
      const start = startOfMonth(currentMonth).toISOString().split('T')[0]
      const end = endOfMonth(currentMonth).toISOString().split('T')[0]
      const res = await fetch(`/api/attendance?startDate=${start}&endDate=${end}&limit=1000`)
      const data = await res.json()
      
      // Group by user
      const grouped: MonthlyData = {}
      data.attendances?.forEach((att: TeamAttendanceRecord) => {
        if (!grouped[att.userId]) {
          grouped[att.userId] = {
            name: att.user?.name || 'Unknown',
            records: [],
          }
        }
        grouped[att.userId].records.push(att)
      })
      
      setMonthlyData(grouped)
    } catch (err) {
      console.error('Failed to fetch monthly data:', err)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchTeamAttendance()
    fetchMonthlyData()
  }, [fetchTeamAttendance, fetchMonthlyData])

  const formatTime = (time: string | null | undefined) => {
    if (!time) return '-'
    return new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusBadge = (status: string, mode: string) => {
    if (mode === 'WFH') {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🏠 WFH</Badge>
    }
    
    switch (status) {
      case 'Present':
        return <Badge className="bg-green-100 text-green-800 border-green-200">✅ Present</Badge>
      case 'Late':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">⏰ Late</Badge>
      case 'Absent':
        return <Badge className="bg-red-100 text-red-800 border-red-200">❌ Absent</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getCalendarDayColor = (date: Date, record: TeamAttendanceRecord | undefined) => {
    if (!record) return 'bg-gray-100'
    if (record.mode === 'WFH') return 'bg-blue-500'
    if (record.status === 'Absent') return 'bg-red-500'
    if (record.status === 'Late') return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const handleCorrection = async () => {
    // TODO: Implement attendance correction API
    alert('Attendance correction feature coming soon')
    setCorrectionDialogOpen(false)
    setCorrectionReason('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading team attendance...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Summary Strip */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.teamSize}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.presentToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Late Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.lateToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">WFH Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.wfhToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.absentToday}</div>
          </CardContent>
        </Card>
      </div>

      {/* Flags & Alerts */}
      {flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Flags & Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {flags.map((flag, idx) => (
                <Alert
                  key={idx}
                  variant={flag.severity === 'error' ? 'destructive' : 'default'}
                  className={flag.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' : ''}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{flag.employeeName}</strong>: {flag.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Attendance (Live)
          </CardTitle>
          <CardDescription>Real-time attendance status for your team</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Late Count</TableHead>
                <TableHead>WFH</TableHead>
                <TableHead>Tasks Done</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No team members found
                  </TableCell>
                </TableRow>
              ) : (
                teamMembers.map((member) => (
                  <TableRow
                    key={member.id}
                    className={`
                      ${member.status === 'Late' ? 'bg-yellow-50' : ''}
                      ${member.status === 'Absent' ? 'bg-red-50' : ''}
                    `}
                  >
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{formatTime(member.checkIn)}</TableCell>
                    <TableCell>{getStatusBadge(member.status, member.mode || 'OFFICE')}</TableCell>
                    <TableCell>
                      {member.lateCount > 0 ? (
                        <Badge variant="outline" className="text-yellow-600">
                          {member.lateCount}
                        </Badge>
                      ) : (
                        '0'
                      )}
                    </TableCell>
                    <TableCell>{member.isWFH ? '✅' : '❌'}</TableCell>
                    <TableCell>{member.tasksDone}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedEmployee(member.id)
                        }}
                      >
                        View Calendar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Performance Correlation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Correlation
          </CardTitle>
          <CardDescription>Attendance vs Productivity metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Attendance vs Tasks Completed correlation analysis coming soon
            </p>
            {/* TODO: Add charts for attendance vs tasks, deadlines, productivity */}
          </div>
        </CardContent>
      </Card>

      {/* Employee Calendar Modal */}
      {selectedEmployee && (
        <Dialog open={selectedEmployee !== null} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {monthlyData[selectedEmployee]?.name || 'Employee'} - Monthly Calendar
              </DialogTitle>
              <DialogDescription>
                {format(currentMonth, 'MMMM yyyy')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                >
                  Next
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
                {eachDayOfInterval({
                  start: startOfMonth(currentMonth),
                  end: endOfMonth(currentMonth),
                }).map(day => {
                  const record = monthlyData[selectedEmployee]?.records.find(r =>
                    isSameDay(new Date(r.date), day)
                  )
                  return (
                    <div
                      key={day.toISOString()}
                      className={`
                        aspect-square p-2 rounded-md text-sm font-medium
                        ${getCalendarDayColor(day, record)}
                        ${record ? 'text-white' : 'text-gray-700 bg-gray-100'}
                      `}
                    >
                      {format(day, 'd')}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500"></div>
                  <span>Late</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500"></div>
                  <span>WFH</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500"></div>
                  <span>Absent</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Correction Dialog */}
      <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Attendance Correction</DialogTitle>
            <DialogDescription>
              Add a correction with reason for this attendance record
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Enter reason for correction..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCorrection}>Submit Correction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

