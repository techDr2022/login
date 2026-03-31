'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Users,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { formatDateLocal } from '@/lib/utils'

interface WFHActivityData {
  userId: string
  userName: string
  email: string
  today: {
    attendance: {
      loginTime: string | null
      logoutTime: string | null
      lastActivityTime: string | null
      wfhActivityPings: number
      totalHours: number | null
    } | null
    metrics: {
      activityScore: number
      totalTaskTime: number
      tasksCompleted: number
      tasksInProgress: number
      taskUpdates: number
      inactivityWarning: {
        minutes: number
        message: string
      } | null
    }
  }
}

export function WFHActivityMonitor() {
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [wfhData, setWfhData] = useState<WFHActivityData[]>([])
  const [loading, setLoading] = useState(true)
  const [inactivityThreshold, setInactivityThreshold] = useState(120) // minutes

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=EMPLOYEE')
      const data = await res.json()
      setEmployees(data.users || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }, [])

  const fetchWFHActivity = useCallback(async () => {
    try {
      if (selectedEmployee === 'all') {
        // Fetch for all employees
        const allData: WFHActivityData[] = []
        for (const emp of employees) {
          try {
            const res = await fetch(`/api/attendance/wfh-activity?userId=${emp.id}`)
            const data = await res.json()
            // Only include if in WFH mode and clocked in
            if (data.today?.attendance && 
                data.today.attendance.mode === 'WFH' && 
                data.today.attendance.loginTime) {
              allData.push({
                userId: emp.id,
                userName: emp.name,
                email: emp.email,
                today: data.today,
              })
            }
          } catch (err) {
            console.error(`Failed to fetch WFH data for ${emp.name}:`, err)
          }
        }
        setWfhData(allData)
      } else {
        // Fetch for selected employee
        const res = await fetch(`/api/attendance/wfh-activity?userId=${selectedEmployee}`)
        const data = await res.json()
        const emp = employees.find(e => e.id === selectedEmployee)
        if (emp && data.today) {
          setWfhData([{
            userId: emp.id,
            userName: emp.name,
            email: emp.email,
            today: data.today,
          }])
        } else {
          setWfhData([])
        }
      }
    } catch (err) {
      console.error('Failed to fetch WFH activity:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedEmployee, employees])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    if (employees.length > 0) {
      fetchWFHActivity()
      // Refresh every 2 minutes
      const interval = setInterval(fetchWFHActivity, 2 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [employees, fetchWFHActivity])

  const getActivityScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getActivityScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-800 border-green-200">Excellent</Badge>
    if (score >= 50) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Fair</Badge>
    return <Badge className="bg-red-100 text-red-800 border-red-200">Poor</Badge>
  }

  const formatTime = (time: string | null | undefined) => {
    if (!time) return '-'
    return format(new Date(time), 'hh:mm a')
  }

  // Filter data based on inactivity threshold
  const filteredData = wfhData.filter(data => {
    if (!data.today.attendance?.lastActivityTime) return true
    const lastActivity = new Date(data.today.attendance.lastActivityTime)
    const now = new Date()
    const minutesSinceLastActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60)
    return minutesSinceLastActivity >= inactivityThreshold
  })

  const activeWFHCount = wfhData.filter(d => 
    d.today.attendance && 
    !d.today.attendance.logoutTime
  ).length

  const inactiveCount = filteredData.length
  const avgActivityScore = wfhData.length > 0
    ? wfhData.reduce((sum, d) => sum + (d.today.metrics.activityScore || 0), 0) / wfhData.length
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading WFH activity data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active WFH
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{activeWFHCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently working from home
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Inactive Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{inactiveCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No activity for {inactivityThreshold}+ min
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Avg Activity Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getActivityScoreColor(avgActivityScore)}`}>
              {avgActivityScore.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average across all WFH employees
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wfhData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Employees with WFH records
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            WFH Activity Monitor
          </CardTitle>
          <CardDescription>
            Monitor work-from-home activity and productivity metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label>Inactivity Threshold (minutes)</Label>
              <Input
                type="number"
                value={inactivityThreshold}
                onChange={(e) => setInactivityThreshold(parseInt(e.target.value) || 120)}
                min="30"
                max="480"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Show employees inactive for this many minutes or more
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WFH Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>WFH Activity Details</CardTitle>
          <CardDescription>
            Real-time activity tracking and productivity metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                {selectedEmployee === 'all' 
                  ? 'No WFH employees found or no inactivity detected'
                  : 'No WFH activity data found for this employee'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Activity Score</TableHead>
                    <TableHead>Activity Pings</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Tasks Completed</TableHead>
                    <TableHead>Task Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((data) => (
                    <TableRow key={data.userId}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{data.userName}</div>
                          <div className="text-xs text-muted-foreground">{data.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${getActivityScoreColor(data.today.metrics.activityScore)}`}>
                            {data.today.metrics.activityScore}%
                          </span>
                          {getActivityScoreBadge(data.today.metrics.activityScore)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {data.today.attendance?.wfhActivityPings || 0}
                      </TableCell>
                      <TableCell>
                        {data.today.attendance?.lastActivityTime ? (
                          <div>
                            <div>{formatTime(data.today.attendance.lastActivityTime)}</div>
                            {data.today.metrics.inactivityWarning && (
                              <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                <AlertTriangle className="h-3 w-3" />
                                {data.today.metrics.inactivityWarning.minutes} min ago
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          {data.today.metrics.tasksCompleted}
                        </div>
                      </TableCell>
                      <TableCell>
                        {data.today.metrics.totalTaskTime.toFixed(1)}h
                      </TableCell>
                      <TableCell>
                        {data.today.attendance?.logoutTime ? (
                          <Badge variant="outline" className="bg-gray-100">
                            Clocked Out
                          </Badge>
                        ) : data.today.metrics.inactivityWarning ? (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <Activity className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {data.today.attendance?.totalHours 
                          ? `${data.today.attendance.totalHours.toFixed(2)}h`
                          : data.today.attendance?.loginTime
                          ? 'In Progress'
                          : '-'}
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

