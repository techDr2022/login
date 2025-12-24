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
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Building2, 
  Filter,
  FileText,
  Settings,
  Download,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon
} from 'lucide-react'
import { format, subMonths } from 'date-fns'

interface GlobalStats {
  totalEmployees: number
  todayPresentPercent: number
  avgLateCount: number
  wfhPercent: number
  absenteeismPercent: number
}

interface AttendanceLog {
  id: string
  userId: string
  userName: string
  date: string
  loginTime?: string | null
  logoutTime?: string | null
  status: string
  mode: string
  ipAddress?: string | null
  deviceInfo?: string | null
  editedBy?: string | null
  editedAt?: string | null
}

interface OfficeHourlyData {
  hour: number
  loginCount: number
}

export function SuperAdminAttendancePanel() {
  const { data: session } = useSession()
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([])
  const [hourlyData, setHourlyData] = useState<OfficeHourlyData[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  })
  const [attendanceType, setAttendanceType] = useState<string>('all')
  
  // Settings
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [settings, setSettings] = useState({
    officeStartHour: 10,
    officeStartMinute: 0,
    officeEndHour: 19,
    officeEndMinute: 0,
    lateThreshold: 5,
    lunchDuration: 30,
  })

  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([])

  // Fetch global stats
  const fetchGlobalStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/attendance?startDate=${today}&endDate=${today}&limit=1000`)
      const data = await res.json()
      
      // Fetch all employees
      const employeesRes = await fetch('/api/users?role=EMPLOYEE')
      const employeesData = await employeesRes.json()
      const totalEmployees = employeesData.users?.length || 0
      
      const attendances = data.attendances || []
      const presentCount = attendances.filter((a: any) => a.status === 'Present').length
      const lateCount = attendances.filter((a: any) => a.status === 'Late').length
      const wfhCount = attendances.filter((a: any) => a.mode === 'WFH').length
      const absentCount = totalEmployees - attendances.length
      
      setGlobalStats({
        totalEmployees,
        todayPresentPercent: totalEmployees > 0 ? (presentCount / totalEmployees) * 100 : 0,
        avgLateCount: lateCount,
        wfhPercent: totalEmployees > 0 ? (wfhCount / totalEmployees) * 100 : 0,
        absenteeismPercent: totalEmployees > 0 ? (absentCount / totalEmployees) * 100 : 0,
      })
    } catch (err) {
      console.error('Failed to fetch global stats:', err)
    }
  }, [])

  // Fetch attendance logs
  const fetchAttendanceLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: '100',
        ...(selectedEmployee !== 'all' && { userId: selectedEmployee }),
        ...(dateRange.from && { startDate: dateRange.from.toISOString().split('T')[0] }),
        ...(dateRange.to && { endDate: dateRange.to.toISOString().split('T')[0] }),
      })
      
      const res = await fetch(`/api/attendance?${params}`)
      const data = await res.json()
      
      const logs: AttendanceLog[] = (data.attendances || []).map((att: any) => ({
        id: att.id,
        userId: att.userId,
        userName: att.User?.name || 'Unknown',
        date: att.date,
        loginTime: att.loginTime,
        logoutTime: att.logoutTime,
        status: att.status,
        mode: att.mode,
        ipAddress: att.ipAddress || null,
        deviceInfo: att.deviceInfo || null,
        editedBy: att.editedBy || null,
        editedAt: att.editedAt || null,
      }))
      
      // Filter by attendance type
      let filteredLogs = logs
      if (attendanceType !== 'all') {
        if (attendanceType === 'Present') {
          filteredLogs = logs.filter(l => l.status === 'Present')
        } else if (attendanceType === 'Late') {
          filteredLogs = logs.filter(l => l.status === 'Late')
        } else if (attendanceType === 'Absent') {
          filteredLogs = logs.filter(l => l.status === 'Absent')
        } else if (attendanceType === 'WFH') {
          filteredLogs = logs.filter(l => l.mode === 'WFH')
        }
      }
      
      setAttendanceLogs(filteredLogs)
    } catch (err) {
      console.error('Failed to fetch attendance logs:', err)
    }
  }, [selectedEmployee, dateRange, attendanceType])

  // Fetch hourly data
  const fetchHourlyData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/attendance?startDate=${today}&endDate=${today}&limit=1000`)
      const data = await res.json()
      
      // Group by hour
      const hourly: { [hour: number]: number } = {}
      data.attendances?.forEach((att: any) => {
        if (att.loginTime) {
          const hour = new Date(att.loginTime).getHours()
          hourly[hour] = (hourly[hour] || 0) + 1
        }
      })
      
      const hourlyArray: OfficeHourlyData[] = Object.entries(hourly).map(([hour, count]) => ({
        hour: parseInt(hour),
        loginCount: count,
      })).sort((a, b) => a.hour - b.hour)
      
      setHourlyData(hourlyArray)
    } catch (err) {
      console.error('Failed to fetch hourly data:', err)
    }
  }, [])

  // Fetch employees
  const fetchUsers = useCallback(async () => {
    try {
      const employeesRes = await fetch('/api/users?role=EMPLOYEE')
      const employeesData = await employeesRes.json()
      setEmployees(employeesData.users || [])
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }, [])

  useEffect(() => {
    fetchGlobalStats()
    fetchAttendanceLogs()
    fetchHourlyData()
    fetchUsers()
    setLoading(false)
  }, [fetchGlobalStats, fetchAttendanceLogs, fetchHourlyData, fetchUsers])

  const formatTime = (time: string | null | undefined) => {
    if (!time) return '-'
    return new Date(time).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Present':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Present</Badge>
      case 'Late':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Late</Badge>
      case 'Absent':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Absent</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const exportPayroll = () => {
    // TODO: Implement payroll export
    alert('Payroll export coming soon')
  }

  const saveSettings = async () => {
    // TODO: Implement settings save API
    alert('Settings save coming soon')
    setSettingsDialogOpen(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading attendance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalStats?.totalEmployees || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today Present %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {globalStats?.todayPresentPercent.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Late Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {globalStats?.avgLateCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">WFH %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {globalStats?.wfhPercent.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Absenteeism %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {globalStats?.absenteeismPercent.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Office-Level View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Office Attendance Graph (Hour-wise)
          </CardTitle>
          <CardDescription>Peak login times and hourly distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end gap-2 h-48">
              {Array.from({ length: 24 }, (_, i) => {
                const data = hourlyData.find(d => d.hour === i)
                const maxCount = Math.max(...hourlyData.map(d => d.loginCount), 1)
                const height = data ? (data.loginCount / maxCount) * 100 : 0
                
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-muted rounded-t" style={{ height: `${height}%` }}>
                      {data && data.loginCount > 0 && (
                        <div className="h-full bg-primary rounded-t flex items-end justify-center text-white text-xs p-1">
                          {data.loginCount}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{i}h</span>
                  </div>
                )
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              Peak login time: {hourlyData.length > 0 
                ? `${hourlyData.reduce((a, b) => a.loginCount > b.loginCount ? a : b).hour}:00`
                : 'N/A'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
          </CardTitle>
          <CardDescription>Filter attendance logs by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Attendance Type</Label>
              <Select value={attendanceType} onValueChange={setAttendanceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="WFH">WFH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date Range (Last 3 months mandatory)</Label>
              <DateRangePicker
                dateRange={dateRange}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    const monthsDiff = (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24 * 30)
                    if (monthsDiff > 3) {
                      alert('Date range cannot exceed 3 months')
                      return
                    }
                  }
                  setDateRange(range || {})
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Attendance Logs (Immutable)
              </CardTitle>
              <CardDescription>Complete audit trail of all attendance records</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportPayroll}>
                <Download className="w-4 h-4 mr-2" />
                Payroll Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Edited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No attendance logs found
                  </TableCell>
                </TableRow>
              ) : (
                attendanceLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.userName}</TableCell>
                    <TableCell>{format(new Date(log.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{formatTime(log.loginTime)}</TableCell>
                    <TableCell>{formatTime(log.logoutTime)}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.mode}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ipAddress || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.deviceInfo || '-'}
                    </TableCell>
                    <TableCell>
                      {log.editedAt ? (
                        <div className="text-sm">
                          <div className="text-muted-foreground">By: {log.editedBy || 'Unknown'}</div>
                          <div className="text-xs">{formatTime(log.editedAt)}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attendance Settings</DialogTitle>
            <DialogDescription>
              Configure office timings, late threshold, and other attendance parameters
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Office Start Hour</Label>
                <Input
                  type="number"
                  value={settings.officeStartHour}
                  onChange={(e) => setSettings({ ...settings, officeStartHour: parseInt(e.target.value) })}
                  min="0"
                  max="23"
                />
              </div>
              <div>
                <Label>Office Start Minute</Label>
                <Input
                  type="number"
                  value={settings.officeStartMinute}
                  onChange={(e) => setSettings({ ...settings, officeStartMinute: parseInt(e.target.value) })}
                  min="0"
                  max="59"
                />
              </div>
              <div>
                <Label>Office End Hour</Label>
                <Input
                  type="number"
                  value={settings.officeEndHour}
                  onChange={(e) => setSettings({ ...settings, officeEndHour: parseInt(e.target.value) })}
                  min="0"
                  max="23"
                />
              </div>
              <div>
                <Label>Office End Minute</Label>
                <Input
                  type="number"
                  value={settings.officeEndMinute}
                  onChange={(e) => setSettings({ ...settings, officeEndMinute: parseInt(e.target.value) })}
                  min="0"
                  max="59"
                />
              </div>
              <div>
                <Label>Late Threshold (minutes)</Label>
                <Input
                  type="number"
                  value={settings.lateThreshold}
                  onChange={(e) => setSettings({ ...settings, lateThreshold: parseInt(e.target.value) })}
                  min="0"
                />
              </div>
              <div>
                <Label>Lunch Duration (minutes)</Label>
                <Input
                  type="number"
                  value={settings.lunchDuration}
                  onChange={(e) => setSettings({ ...settings, lunchDuration: parseInt(e.target.value) })}
                  min="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

