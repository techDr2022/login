'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Home, 
  Timer, 
  LogIn, 
  LogOut,
  UtensilsCrossed,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Activity
} from 'lucide-react'
import { clockIn, clockOut, startLunchBreak, endLunchBreak, pingWFHActivity } from '@/app/actions/attendance-actions'
import { ATTENDANCE_CONFIG } from '@/lib/attendance-config'
import { AttendanceMode, AttendanceStatus } from '@prisma/client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isPast, isFuture } from 'date-fns'

interface AttendanceRecord {
  id: string
  date: string
  loginTime?: string | null
  logoutTime?: string | null
  lunchStart?: string | null
  lunchEnd?: string | null
  totalHours?: number | null
  status: string
  mode: string
  lateSignInMinutes?: number | null
  wfhActivityPings?: number
  lastActivityTime?: string | null
}

interface MonthlySummary {
  totalWorkingDays: number
  daysPresent: number
  lateCount: number
  wfhDays: number
  leavesTaken: number
  overtimeHours: number
}

export function EmployeeAttendanceDashboard() {
  const { data: session } = useSession()
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [monthlyData, setMonthlyData] = useState<AttendanceRecord[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedDateData, setSelectedDateData] = useState<AttendanceRecord | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [clocking, setClocking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'7days' | '30days' | '3months'>('30days')
  const [historyData, setHistoryData] = useState<AttendanceRecord[]>([])
  const [wfhActivityInterval, setWfhActivityInterval] = useState<NodeJS.Timeout | null>(null)

  // Fetch today's attendance
  const fetchTodayAttendance = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/attendance?startDate=${today}&endDate=${today}&limit=1`)
      const data = await res.json()
      if (data.attendances && data.attendances.length > 0) {
        setTodayAttendance(data.attendances[0])
        
        // Start WFH activity pings if in WFH mode and not clocked out
        if (data.attendances[0].mode === 'WFH' && !data.attendances[0].logoutTime) {
          startWFHActivityPings()
        } else {
          stopWFHActivityPings()
        }
      } else {
        setTodayAttendance(null)
        stopWFHActivityPings()
      }
    } catch (err) {
      console.error('Failed to fetch today attendance:', err)
    }
  }, [])

  // Fetch monthly data
  const fetchMonthlyData = useCallback(async () => {
    try {
      const start = startOfMonth(currentMonth).toISOString().split('T')[0]
      const end = endOfMonth(currentMonth).toISOString().split('T')[0]
      const res = await fetch(`/api/attendance?startDate=${start}&endDate=${end}&limit=100`)
      const data = await res.json()
      setMonthlyData(data.attendances || [])
      
      // Calculate summary
      const summary: MonthlySummary = {
        totalWorkingDays: 0,
        daysPresent: 0,
        lateCount: 0,
        wfhDays: 0,
        leavesTaken: 0,
        overtimeHours: 0,
      }
      
      data.attendances?.forEach((att: AttendanceRecord) => {
        if (att.status === 'Present' || att.status === 'Late') {
          summary.totalWorkingDays++
        }
        if (att.status === 'Present') {
          summary.daysPresent++
        }
        if (att.status === 'Late') {
          summary.lateCount++
        }
        if (att.mode === 'WFH' && att.status === 'Present') {
          summary.wfhDays++
        }
        if (att.mode === 'LEAVE') {
          summary.leavesTaken++
        }
        // Calculate overtime (hours > 8.5)
        if (att.totalHours && att.totalHours > 8.5) {
          summary.overtimeHours += att.totalHours - 8.5
        }
      })
      
      setMonthlySummary(summary)
    } catch (err) {
      console.error('Failed to fetch monthly data:', err)
    }
  }, [currentMonth])

  // Fetch history data
  const fetchHistoryData = useCallback(async () => {
    try {
      const end = new Date()
      const start = new Date()
      
      if (historyFilter === '7days') {
        start.setDate(start.getDate() - 7)
      } else if (historyFilter === '30days') {
        start.setDate(start.getDate() - 30)
      } else {
        start.setMonth(start.getMonth() - 3)
      }
      
      const res = await fetch(
        `/api/attendance?startDate=${start.toISOString().split('T')[0]}&endDate=${end.toISOString().split('T')[0]}&limit=100`
      )
      const data = await res.json()
      setHistoryData(data.attendances || [])
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }, [historyFilter])

  // WFH Activity Pings
  const startWFHActivityPings = useCallback(() => {
    if (wfhActivityInterval) return
    
    const interval = setInterval(async () => {
      try {
        await pingWFHActivity()
        await fetchTodayAttendance()
      } catch (err) {
        console.error('WFH activity ping failed:', err)
      }
    }, ATTENDANCE_CONFIG.WFH_ACTIVITY_PING_INTERVAL_MINUTES * 60 * 1000)
    
    setWfhActivityInterval(interval)
  }, [wfhActivityInterval, fetchTodayAttendance])

  const stopWFHActivityPings = useCallback(() => {
    if (wfhActivityInterval) {
      clearInterval(wfhActivityInterval)
      setWfhActivityInterval(null)
    }
  }, [wfhActivityInterval])

  useEffect(() => {
    fetchTodayAttendance()
    fetchMonthlyData()
    fetchHistoryData()
    setLoading(false)
    
    return () => {
      stopWFHActivityPings()
    }
  }, [fetchTodayAttendance, fetchMonthlyData, fetchHistoryData, stopWFHActivityPings])

  const handleClockIn = async (mode: AttendanceMode) => {
    setClocking(true)
    setError('')
    setSuccess('')
    try {
      await clockIn(mode)
      setSuccess('Clocked in successfully')
      await fetchTodayAttendance()
      await fetchMonthlyData()
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
      stopWFHActivityPings()
      await fetchTodayAttendance()
      await fetchMonthlyData()
    } catch (err: any) {
      setError(err.message || 'Failed to clock out')
    } finally {
      setClocking(false)
    }
  }

  const handleLunchStart = async () => {
    try {
      await startLunchBreak()
      await fetchTodayAttendance()
    } catch (err: any) {
      setError(err.message || 'Failed to start lunch break')
    }
  }

  const handleLunchEnd = async () => {
    try {
      await endLunchBreak()
      await fetchTodayAttendance()
    } catch (err: any) {
      setError(err.message || 'Failed to end lunch break')
    }
  }

  const formatTime = (time: string | null | undefined) => {
    if (!time) return '-'
    return new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (hours: number | null | undefined) => {
    if (!hours) return '-'
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Present':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'Late':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'Absent':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string, mode: string) => {
    if (mode === 'WFH') {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🏠 WFH</Badge>
    }
    if (mode === 'LEAVE') {
      return <Badge className="bg-gray-100 text-gray-800 border-gray-200">⚫ Leave</Badge>
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

  const getCalendarDayColor = (date: Date, attendance: AttendanceRecord | undefined) => {
    if (!attendance) return 'bg-gray-100'
    
    if (attendance.mode === 'LEAVE') return 'bg-gray-800'
    if (attendance.mode === 'WFH') return 'bg-blue-500'
    if (attendance.status === 'Absent') return 'bg-red-500'
    if (attendance.status === 'Late') return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const getAttendanceForDate = (date: Date) => {
    return monthlyData.find(a => isSameDay(new Date(a.date), date))
  }

  const handleDateClick = (date: Date) => {
    const attendance = getAttendanceForDate(date)
    setSelectedDate(date)
    setSelectedDateData(attendance || null)
  }

  const exportToPDF = () => {
    // TODO: Implement PDF export
    alert('PDF export coming soon')
  }

  const exportToExcel = () => {
    // TODO: Implement Excel export
    alert('Excel export coming soon')
  }

  // Check WFH inactivity
  const isWFHInactive = todayAttendance?.mode === 'WFH' && 
    todayAttendance?.lastActivityTime && 
    !todayAttendance?.logoutTime &&
    (new Date().getTime() - new Date(todayAttendance.lastActivityTime).getTime()) > 
    (ATTENDANCE_CONFIG.WFH_INACTIVITY_THRESHOLD_MINUTES * 60 * 1000)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading attendance...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{session?.user?.name || 'Employee'}</CardTitle>
              <CardDescription className="mt-1">
                {session?.user?.role?.replace('_', ' ') || 'Employee'} • Office / WFH / Hybrid
              </CardDescription>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Office Hours</p>
              <p className="font-semibold">10:00 AM – 7:00 PM</p>
            </div>
            <div>
              <p className="text-muted-foreground">Lunch Break</p>
              <p className="font-semibold">1:00 PM – 1:30 PM</p>
            </div>
            <div>
              <p className="text-muted-foreground">Late Threshold</p>
              <p className="font-semibold">After 10:05 AM</p>
            </div>
            <div>
              <p className="text-muted-foreground">Employment Type</p>
              <p className="font-semibold">Hybrid</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Today's Attendance Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today&apos;s Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {!todayAttendance?.loginTime ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={() => handleClockIn(AttendanceMode.OFFICE)} disabled={clocking} size="lg">
                  <LogIn className="w-4 h-4 mr-2" />
                  Clock In (Office)
                </Button>
                <Button onClick={() => handleClockIn(AttendanceMode.WFH)} disabled={clocking} variant="outline" size="lg">
                  <Home className="w-4 h-4 mr-2" />
                  Clock In (WFH)
                </Button>
              </div>
            </div>
          ) : !todayAttendance?.logoutTime ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Check-in Time</p>
                  <p className="font-semibold text-lg">{formatTime(todayAttendance.loginTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Check-out Time</p>
                  <p className="font-semibold text-lg">-</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Lunch Start</p>
                  <p className="font-semibold text-lg">
                    {todayAttendance.lunchStart ? formatTime(todayAttendance.lunchStart) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Lunch End</p>
                  <p className="font-semibold text-lg">
                    {todayAttendance.lunchEnd ? formatTime(todayAttendance.lunchEnd) : '-'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Working Hours</p>
                  <p className="font-semibold text-lg">
                    {todayAttendance.totalHours ? formatDuration(todayAttendance.totalHours) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(todayAttendance.status, todayAttendance.mode)}
                    {todayAttendance.lateSignInMinutes && todayAttendance.lateSignInMinutes > 0 && (
                      <span className="text-sm text-yellow-600">
                        ({todayAttendance.lateSignInMinutes} min late)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2 flex-wrap">
                {!todayAttendance.lunchStart && (
                  <Button onClick={handleLunchStart} variant="outline" size="sm">
                    <UtensilsCrossed className="w-4 h-4 mr-2" />
                    Start Lunch
                  </Button>
                )}
                {todayAttendance.lunchStart && !todayAttendance.lunchEnd && (
                  <Button onClick={handleLunchEnd} variant="outline" size="sm">
                    <UtensilsCrossed className="w-4 h-4 mr-2" />
                    End Lunch
                  </Button>
                )}
                <Button onClick={handleClockOut} variant="destructive" size="lg">
                  <LogOut className="w-4 h-4 mr-2" />
                  Clock Out
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Check-in Time</p>
                  <p className="font-semibold text-lg">{formatTime(todayAttendance.loginTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Check-out Time</p>
                  <p className="font-semibold text-lg">{formatTime(todayAttendance.logoutTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Lunch Start</p>
                  <p className="font-semibold text-lg">
                    {todayAttendance.lunchStart ? formatTime(todayAttendance.lunchStart) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Lunch End</p>
                  <p className="font-semibold text-lg">
                    {todayAttendance.lunchEnd ? formatTime(todayAttendance.lunchEnd) : '-'}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Working Hours</p>
                  <p className="font-semibold text-lg">
                    {todayAttendance.totalHours ? formatDuration(todayAttendance.totalHours) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  {getStatusBadge(todayAttendance.status, todayAttendance.mode)}
                </div>
              </div>
            </div>
          )}

          {/* WFH Activity Status */}
          {todayAttendance?.mode === 'WFH' && !todayAttendance?.logoutTime && (
            <Alert className={isWFHInactive ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}>
              <Activity className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">WFH Activity Status</p>
                  <p className="text-sm">
                    Activity Pings: {todayAttendance.wfhActivityPings || 0}
                  </p>
                  {todayAttendance.lastActivityTime && (
                    <p className="text-sm">
                      Last Activity: {formatTime(todayAttendance.lastActivityTime)}
                    </p>
                  )}
                  {isWFHInactive && (
                    <p className="text-sm font-semibold text-red-600">
                      ⚠️ No activity detected for 2+ hours. Please ensure you&apos;re working.
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      {monthlySummary && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Working Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlySummary.totalWorkingDays}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Days Present</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{monthlySummary.daysPresent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Late Count</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{monthlySummary.lateCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">WFH Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{monthlySummary.wfhDays}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Leaves Taken</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlySummary.leavesTaken}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overtime</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(monthlySummary.overtimeHours)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Attendance Calendar
            </CardTitle>
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
          </div>
          <CardDescription>
            {format(currentMonth, 'MMMM yyyy')} • Click any date for details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
            {calendarDays.map(day => {
              const attendance = getAttendanceForDate(day)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDateClick(day)}
                  className={`
                    aspect-square p-2 rounded-md text-sm font-medium transition-colors
                    ${isSelected ? 'ring-2 ring-primary' : ''}
                    ${isToday(day) ? 'ring-2 ring-blue-500' : ''}
                    ${attendance ? getCalendarDayColor(day, attendance) : 'bg-gray-100 hover:bg-gray-200'}
                    ${attendance ? 'text-white' : 'text-gray-700'}
                    ${isFuture(day) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  disabled={isFuture(day)}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
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
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-800"></div>
              <span>Leave</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>View and export your attendance records</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={historyFilter} onValueChange={(v: any) => setHistoryFilter(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="3months">Last 3 months</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {historyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No attendance records found</p>
            ) : (
              historyData.map(record => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{format(new Date(record.date), 'MMM dd, yyyy')}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(record.loginTime)} - {formatTime(record.logoutTime)}
                      </p>
                    </div>
                    {getStatusBadge(record.status, record.mode)}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatDuration(record.totalHours || 0)}</p>
                    {record.mode === 'WFH' && (
                      <p className="text-xs text-muted-foreground">
                        {record.wfhActivityPings || 0} activity pings
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Date Detail Dialog */}
      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, 'EEEE, MMMM dd, yyyy')}
            </DialogTitle>
            <DialogDescription>
              Attendance details for this date
            </DialogDescription>
          </DialogHeader>
          {selectedDateData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-semibold">{getStatusBadge(selectedDateData.status, selectedDateData.mode)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mode</p>
                  <p className="font-semibold">{selectedDateData.mode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-in</p>
                  <p className="font-semibold">{formatTime(selectedDateData.loginTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-out</p>
                  <p className="font-semibold">{formatTime(selectedDateData.logoutTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lunch Start</p>
                  <p className="font-semibold">{formatTime(selectedDateData.lunchStart)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lunch End</p>
                  <p className="font-semibold">{formatTime(selectedDateData.lunchEnd)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="font-semibold">{formatDuration(selectedDateData.totalHours || 0)}</p>
                </div>
                {selectedDateData.mode === 'WFH' && (
                  <div>
                    <p className="text-sm text-muted-foreground">Activity Pings</p>
                    <p className="font-semibold">{selectedDateData.wfhActivityPings || 0}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No attendance record for this date</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

