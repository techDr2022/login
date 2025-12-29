'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { 
  Clock, 
  Calendar,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  Home,
  Laptop
} from 'lucide-react'
import { format } from 'date-fns'
import { clockIn, clockOut } from '@/app/actions/attendance-actions'
import { AttendanceMode } from '@prisma/client'

interface AttendanceRecord {
  id: string
  date: string
  loginTime?: string | null
  logoutTime?: string | null
  status: string
  mode: string
  totalHours?: number | null
  lateSignInMinutes?: number | null
  earlyLogoutMinutes?: number | null
}

export function EmployeeAttendancePanel() {
  const { data: session } = useSession()
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [clockingIn, setClockingIn] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)
  const [selectedMode, setSelectedMode] = useState<AttendanceMode>(AttendanceMode.OFFICE)

  const fetchTodayAttendance = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/attendance?userId=${session?.user?.id}&startDate=${today}&endDate=${today}`)
      const data = await res.json()
      
      if (data.attendances && data.attendances.length > 0) {
        const att = data.attendances[0]
        setTodayAttendance({
          id: att.id,
          date: att.date,
          loginTime: att.loginTime,
          logoutTime: att.logoutTime,
          status: att.status,
          mode: att.mode,
          totalHours: att.totalHours,
          lateSignInMinutes: att.lateSignInMinutes,
          earlyLogoutMinutes: att.earlyLogoutMinutes,
        })
      } else {
        setTodayAttendance(null)
      }
    } catch (err) {
      console.error('Failed to fetch today attendance:', err)
    }
  }, [session?.user?.id])

  const fetchAttendanceHistory = useCallback(async () => {
    try {
      // Fetch last 30 days
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      const res = await fetch(
        `/api/attendance?userId=${session?.user?.id}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}&limit=30`
      )
      const data = await res.json()
      
      const records: AttendanceRecord[] = (data.attendances || []).map((att: any) => ({
        id: att.id,
        date: att.date,
        loginTime: att.loginTime,
        logoutTime: att.logoutTime,
        status: att.status,
        mode: att.mode,
        totalHours: att.totalHours,
        lateSignInMinutes: att.lateSignInMinutes,
        earlyLogoutMinutes: att.earlyLogoutMinutes,
      }))
      
      setAttendanceHistory(records)
    } catch (err) {
      console.error('Failed to fetch attendance history:', err)
    }
  }, [session?.user?.id])

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchTodayAttendance(), fetchAttendanceHistory()])
      setLoading(false)
    }
    
    if (session?.user?.id) {
      loadData()
    }
  }, [session?.user?.id, fetchTodayAttendance, fetchAttendanceHistory])

  const handleClockIn = async () => {
    try {
      setClockingIn(true)
      await clockIn(selectedMode)
      await fetchTodayAttendance()
      await fetchAttendanceHistory()
    } catch (error: any) {
      alert(error.message || 'Failed to clock in')
    } finally {
      setClockingIn(false)
    }
  }

  const handleClockOut = async () => {
    try {
      setClockingOut(true)
      await clockOut()
      await fetchTodayAttendance()
      await fetchAttendanceHistory()
    } catch (error: any) {
      alert(error.message || 'Failed to clock out')
    } finally {
      setClockingOut(false)
    }
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

  const formatTime = (time: string | null | undefined) => {
    if (!time) return '-'
    return format(new Date(time), 'hh:mm a')
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

  const canClockIn = !todayAttendance || !todayAttendance.loginTime
  const canClockOut = todayAttendance?.loginTime && !todayAttendance?.logoutTime

  return (
    <div className="space-y-6">
      {/* Clock In/Out Section */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Clock In/Out
          </CardTitle>
          <CardDescription>Manage your daily attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {canClockIn && (
              <div className="space-y-4">
                <div>
                  <Label>Attendance Mode</Label>
                  <Select 
                    value={selectedMode} 
                    onValueChange={(value) => setSelectedMode(value as AttendanceMode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AttendanceMode.OFFICE}>
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4" />
                          Office
                        </div>
                      </SelectItem>
                      <SelectItem value={AttendanceMode.WFH}>
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4" />
                          Work From Home
                        </div>
                      </SelectItem>
                      <SelectItem value={AttendanceMode.LEAVE}>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Leave
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleClockIn} 
                  disabled={clockingIn}
                  className="w-full"
                  size="lg"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {clockingIn ? 'Clocking In...' : 'Clock In'}
                </Button>
              </div>
            )}

            {canClockOut && (
              <Button 
                onClick={handleClockOut} 
                disabled={clockingOut}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {clockingOut ? 'Clocking Out...' : 'Clock Out'}
              </Button>
            )}

            {todayAttendance?.logoutTime && (
              <div className="p-4 bg-muted rounded-lg text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium">You have completed your attendance for today</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Check-in: {formatTime(todayAttendance.loginTime)} | 
                  Check-out: {formatTime(todayAttendance.logoutTime)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's Status */}
      {todayAttendance && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today&apos;s Status
            </CardTitle>
            <CardDescription>Your attendance details for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(todayAttendance.status)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mode</p>
                <div className="mt-1">
                  <Badge variant="outline">{todayAttendance.mode}</Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Check-in</p>
                <p className="mt-1 font-medium">{formatTime(todayAttendance.loginTime)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Check-out</p>
                <p className="mt-1 font-medium">{formatTime(todayAttendance.logoutTime)}</p>
              </div>
              {todayAttendance.totalHours && (
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="mt-1 font-medium">{todayAttendance.totalHours.toFixed(2)} hours</p>
                </div>
              )}
              {todayAttendance.lateSignInMinutes && todayAttendance.lateSignInMinutes > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Late by</p>
                  <p className="mt-1 font-medium text-yellow-600">
                    {todayAttendance.lateSignInMinutes} minutes
                  </p>
                </div>
              )}
              {todayAttendance.earlyLogoutMinutes && todayAttendance.earlyLogoutMinutes > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Early by</p>
                  <p className="mt-1 font-medium text-orange-600">
                    {todayAttendance.earlyLogoutMinutes} minutes
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance History */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance History
          </CardTitle>
          <CardDescription>Last 30 days of your attendance</CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">No attendance records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{formatTime(record.loginTime)}</TableCell>
                      <TableCell>{formatTime(record.logoutTime)}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.mode}</Badge>
                      </TableCell>
                      <TableCell>
                        {record.totalHours ? `${record.totalHours.toFixed(2)}h` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

