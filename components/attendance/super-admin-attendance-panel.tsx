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
import { DatePicker } from '@/components/ui/date-picker'
import { markAllAttendanceForDay, updateAttendanceMode } from '@/app/actions/attendance-actions'
import { AttendanceMode } from '@prisma/client'
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
  Calendar as CalendarIcon,
  CheckSquare,
  Activity,
  Edit,
  Save,
  X
} from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { formatDateLocal } from '@/lib/utils'
import { WFHActivityMonitor } from './wfh-activity-monitor'

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
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Filters
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  })
  const [attendanceType, setAttendanceType] = useState<string>('all')
  
  // Settings
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false)
  const [payrollDateRange, setPayrollDateRange] = useState<{ from?: Date; to?: Date }>({
    from: subMonths(new Date(), 1),
    to: new Date(),
  })
  const [payrollSelectedEmployee, setPayrollSelectedEmployee] = useState<string>('all')
  const [exportingPayroll, setExportingPayroll] = useState(false)
  const [payrollExportError, setPayrollExportError] = useState<string | null>(null)
  const [markAllDialogOpen, setMarkAllDialogOpen] = useState(false)
  const [markAllDate, setMarkAllDate] = useState<Date | null>(new Date())
  const [markAllMode, setMarkAllMode] = useState<AttendanceMode>(AttendanceMode.OFFICE)
  const [markingAll, setMarkingAll] = useState(false)
  const [markAllResult, setMarkAllResult] = useState<{ success: boolean; message: string } | null>(null)
  const [existingAttendanceCount, setExistingAttendanceCount] = useState<number | null>(null)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null)
  const [editingMode, setEditingMode] = useState<AttendanceMode | null>(null)
  const [updatingMode, setUpdatingMode] = useState(false)
  const [updateModeError, setUpdateModeError] = useState<string | null>(null)
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
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      const today = formatDateLocal(todayDate)
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
        page: page.toString(),
        limit: '10',
        ...(selectedEmployee !== 'all' && { userId: selectedEmployee }),
        ...(dateRange.from && { startDate: formatDateLocal(dateRange.from) }),
        ...(dateRange.to && { endDate: formatDateLocal(dateRange.to) }),
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
        } else if (attendanceType === 'HalfDay') {
          filteredLogs = logs.filter(l => l.status === 'HalfDay')
        } else if (attendanceType === 'Absent') {
          filteredLogs = logs.filter(l => l.status === 'Absent')
        } else if (attendanceType === 'WFH') {
          filteredLogs = logs.filter(l => l.mode === 'WFH')
        }
      }
      
      setAttendanceLogs(filteredLogs)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err) {
      console.error('Failed to fetch attendance logs:', err)
    }
  }, [selectedEmployee, dateRange, attendanceType, page])

  // Fetch hourly data
  const fetchHourlyData = useCallback(async () => {
    try {
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      const today = formatDateLocal(todayDate)
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [selectedEmployee, dateRange, attendanceType])

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
      case 'HalfDay':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Half Day</Badge>
      case 'Absent':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Absent</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const exportPayroll = () => {
    setPayrollExportError(null)
    setPayrollDialogOpen(true)
  }

  const handlePayrollExport = async () => {
    if (!payrollDateRange.from || !payrollDateRange.to) {
      setPayrollExportError('Please select both start and end dates')
      return
    }

    // Check date range doesn't exceed 3 months
    const monthsDiff = (payrollDateRange.to.getTime() - payrollDateRange.from.getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (monthsDiff > 3) {
      setPayrollExportError('Date range cannot exceed 3 months')
      return
    }

    setExportingPayroll(true)
    setPayrollExportError(null)

    try {
      const startDate = formatDateLocal(payrollDateRange.from)
      const endDate = formatDateLocal(payrollDateRange.to)
      let url = `/api/attendance/payroll-export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      
      // Add employee filter if specific employee is selected
      if (payrollSelectedEmployee !== 'all') {
        url += `&userId=${encodeURIComponent(payrollSelectedEmployee)}`
      }

      const response = await fetch(url)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to export payroll' }))
        throw new Error(errorData.error || 'Failed to export payroll')
      }

      // Get the CSV content
      const csvContent = await response.text()
      
      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'payroll-export.csv'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url_blob = URL.createObjectURL(blob)
      link.setAttribute('href', url_blob)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url_blob)

      // Close dialog after successful export
      setTimeout(() => {
        setPayrollDialogOpen(false)
        setPayrollExportError(null)
      }, 500)
    } catch (error) {
      console.error('Error exporting payroll:', error)
      setPayrollExportError(error instanceof Error ? error.message : 'Failed to export payroll. Please try again.')
    } finally {
      setExportingPayroll(false)
    }
  }

  const saveSettings = async () => {
    // TODO: Implement settings save API
    alert('Settings save coming soon')
    setSettingsDialogOpen(false)
  }

  const checkExistingAttendance = useCallback(async (date: Date | null) => {
    if (!date) {
      setExistingAttendanceCount(null)
      return
    }

    setCheckingExisting(true)
    try {
      const dateToCheck = new Date(date)
      dateToCheck.setHours(0, 0, 0, 0)
      const dateStr = formatDateLocal(dateToCheck)
      const res = await fetch(`/api/attendance?startDate=${dateStr}&endDate=${dateStr}&limit=1000`)
      const data = await res.json()
      setExistingAttendanceCount(data.attendances?.length || 0)
    } catch (error) {
      console.error('Failed to check existing attendance:', error)
      setExistingAttendanceCount(null)
    } finally {
      setCheckingExisting(false)
    }
  }, [])

  const handleMarkAllAttendance = async () => {
    if (!markAllDate) {
      setMarkAllResult({ success: false, message: 'Please select a date' })
      return
    }

    setMarkingAll(true)
    setMarkAllResult(null)

    try {
      const result = await markAllAttendanceForDay(markAllDate, markAllMode)
      
      if (result.success) {
        const updatedCount = result.results.filter(r => r.action === 'updated').length
        const createdCount = result.results.filter(r => r.action === 'created').length
        
        setMarkAllResult({
          success: true,
          message: `Successfully marked attendance: ${createdCount} created, ${updatedCount} updated out of ${result.totalEmployees} employees${result.errorCount > 0 ? ` (${result.errorCount} errors)` : ''}`,
        })
        
        // Refresh the attendance logs
        setTimeout(() => {
          fetchAttendanceLogs()
          fetchGlobalStats()
          checkExistingAttendance(markAllDate)
          setMarkAllDialogOpen(false)
          setMarkAllResult(null)
        }, 2000)
      } else {
        setMarkAllResult({ success: false, message: 'Failed to mark all attendance' })
      }
    } catch (error) {
      setMarkAllResult({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred while marking attendance',
      })
    } finally {
      setMarkingAll(false)
    }
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

      {/* WFH Activity Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            WFH Activity Monitoring
          </CardTitle>
          <CardDescription>
            Monitor work-from-home employees&apos; activity and productivity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WFHActivityMonitor />
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
                  <SelectItem value="HalfDay">Half Day</SelectItem>
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
              <Button variant="default" size="sm" onClick={() => setMarkAllDialogOpen(true)}>
                <CheckSquare className="w-4 h-4 mr-2" />
                Mark All Attendance
              </Button>
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
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
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
                      {editingAttendanceId === log.id ? (
                        <Select
                          value={editingMode || log.mode}
                          onValueChange={(value) => setEditingMode(value as AttendanceMode)}
                          disabled={updatingMode}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={AttendanceMode.OFFICE}>Office</SelectItem>
                            <SelectItem value={AttendanceMode.WFH}>WFH</SelectItem>
                            <SelectItem value={AttendanceMode.LEAVE}>Leave</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{log.mode}</Badge>
                      )}
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
                    <TableCell>
                      {editingAttendanceId === log.id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={async () => {
                              if (!editingMode || editingMode === log.mode) {
                                setEditingAttendanceId(null)
                                setEditingMode(null)
                                setUpdateModeError(null)
                                return
                              }
                              
                              setUpdatingMode(true)
                              setUpdateModeError(null)
                              
                              try {
                                await updateAttendanceMode(log.id, editingMode)
                                setEditingAttendanceId(null)
                                setEditingMode(null)
                                // Refresh the attendance logs
                                fetchAttendanceLogs()
                                fetchGlobalStats()
                              } catch (error) {
                                setUpdateModeError(error instanceof Error ? error.message : 'Failed to update mode')
                              } finally {
                                setUpdatingMode(false)
                              }
                            }}
                            disabled={updatingMode || !editingMode || editingMode === log.mode}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingAttendanceId(null)
                              setEditingMode(null)
                              setUpdateModeError(null)
                            }}
                            disabled={updatingMode}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingAttendanceId(log.id)
                            setEditingMode(log.mode as AttendanceMode)
                            setUpdateModeError(null)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {updateModeError && (
            <div className="p-3 m-4 rounded-md bg-red-50 text-red-800 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{updateModeError}</p>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
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

      {/* Payroll Export Dialog */}
      <Dialog open={payrollDialogOpen} onOpenChange={(open) => {
        setPayrollDialogOpen(open)
        if (!open) {
          setPayrollExportError(null)
          setPayrollSelectedEmployee('all')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Payroll Export
            </DialogTitle>
            <DialogDescription>
              Export attendance data for payroll processing (CSV format)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Employee (Optional)</Label>
              <Select value={payrollSelectedEmployee} onValueChange={setPayrollSelectedEmployee}>
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
              <p className="text-xs text-muted-foreground mt-1">
                {payrollSelectedEmployee === 'all' 
                  ? 'Export data for all employees' 
                  : `Export data for: ${employees.find(e => e.id === payrollSelectedEmployee)?.name || 'Selected employee'}`}
              </p>
            </div>
            <div>
              <Label>Date Range (Maximum 3 months)</Label>
              <DateRangePicker
                dateRange={payrollDateRange}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    const monthsDiff = (range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24 * 30)
                    if (monthsDiff > 3) {
                      setPayrollExportError('Date range cannot exceed 3 months')
                      return
                    }
                    setPayrollExportError(null)
                  }
                  setPayrollDateRange(range || {})
                }}
              />
              {payrollDateRange.from && payrollDateRange.to && (
                <p className="text-xs text-muted-foreground mt-2">
                  Exporting from {format(new Date(payrollDateRange.from), 'MMM dd, yyyy')} to {format(new Date(payrollDateRange.to), 'MMM dd, yyyy')}
                </p>
              )}
            </div>
            {payrollExportError && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 border border-red-200 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{payrollExportError}</p>
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> The export will include all attendance records for the selected date range, including:
              </p>
              <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc space-y-1">
                <li>Employee name, email, and job title</li>
                <li>Date, day, status, and mode</li>
                <li>Login/logout times and total hours</li>
                <li>Late minutes and early sign-in/out minutes</li>
                <li>WFH activity pings and remarks</li>
                <li>Public holiday indicators</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPayrollDialogOpen(false)
                setPayrollExportError(null)
              }}
              disabled={exportingPayroll}
            >
              Cancel
            </Button>
            <Button onClick={handlePayrollExport} disabled={exportingPayroll || !payrollDateRange.from || !payrollDateRange.to}>
              {exportingPayroll ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Mark All Attendance Dialog */}
      <Dialog open={markAllDialogOpen} onOpenChange={(open) => {
        setMarkAllDialogOpen(open)
        if (!open) {
          setMarkAllResult(null)
          setExistingAttendanceCount(null)
        } else if (markAllDate) {
          checkExistingAttendance(markAllDate)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Mark All Attendance for Day
            </DialogTitle>
            <DialogDescription>
              Mark attendance as Present for all active employees on the selected date. Existing records will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Date</Label>
              <DatePicker
                date={markAllDate}
                onSelect={(date) => {
                  setMarkAllDate(date)
                  if (date) {
                    checkExistingAttendance(date)
                  }
                }}
                placeholder="Select a date"
              />
              {checkingExisting && (
                <p className="text-xs text-muted-foreground mt-1">Checking existing records...</p>
              )}
              {!checkingExisting && existingAttendanceCount !== null && existingAttendanceCount > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-xs text-yellow-800">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {existingAttendanceCount} employee{existingAttendanceCount !== 1 ? 's' : ''} already have attendance records for this date. They will be updated.
                  </p>
                </div>
              )}
            </div>
            <div>
              <Label>Attendance Mode</Label>
              <Select
                value={markAllMode}
                onValueChange={(value) => setMarkAllMode(value as AttendanceMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AttendanceMode.OFFICE}>Office</SelectItem>
                  <SelectItem value={AttendanceMode.WFH}>WFH</SelectItem>
                  <SelectItem value={AttendanceMode.LEAVE}>Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {markAllResult && (
              <div
                className={`p-3 rounded-md flex items-start gap-2 ${
                  markAllResult.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {markAllResult.success ? (
                  <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                )}
                <p className="text-sm">{markAllResult.message}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMarkAllDialogOpen(false)
                setMarkAllResult(null)
                setMarkAllDate(new Date())
              }}
              disabled={markingAll}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkAllAttendance} disabled={markingAll || !markAllDate}>
              {markingAll ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Marking...
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Mark All Attendance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

