'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, UserCog } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserRole } from '@prisma/client'
import Link from 'next/link'

interface EmployeeDetailProps {
  employeeId: string
}

export function EmployeeDetail({ employeeId }: EmployeeDetailProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [roleUpdating, setRoleUpdating] = useState(false)
  const [error, setError] = useState('')
  
  const isSuperAdmin = session?.user.role === UserRole.SUPER_ADMIN

  useEffect(() => {
    fetchEmployee()
  }, [employeeId])

  const fetchEmployee = async () => {
    try {
      const res = await fetch(`/api/employees/${employeeId}`)
      const data = await res.json()
      setEmployee(data)
    } catch (err) {
      console.error('Failed to fetch employee:', err)
    } finally {
      setLoading(false)
    }
  }

  const getPerformanceBadgeVariant = (score: number) => {
    if (score >= 80) return 'default'
    if (score >= 60) return 'secondary'
    return 'destructive'
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Present':
        return 'default'
      case 'Late':
        return 'secondary'
      case 'Absent':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const handleRoleChange = async (newRole: 'EMPLOYEE' | 'MANAGER') => {
    if (!employee || employee.role === newRole) return
    
    setRoleUpdating(true)
    setError('')
    
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }
      
      const data = await res.json()
      setEmployee({ ...employee, role: data.user.role })
    } catch (err: any) {
      setError(err.message || 'Failed to update role')
    } finally {
      setRoleUpdating(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (!employee) return <div>Employee not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{employee.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={employee.role === 'MANAGER' ? 'default' : 'secondary'}>
                {employee.role === 'MANAGER' ? 'Manager' : 'Employee'}
              </Badge>
              {!employee.isActive && (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
          </div>
        </div>
        {isSuperAdmin && employee.role !== 'SUPER_ADMIN' && (
          <div className="flex items-center gap-2">
            <Select
              value={employee.role}
              onValueChange={(value: 'EMPLOYEE' | 'MANAGER') => handleRoleChange(value)}
              disabled={roleUpdating}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employee.metrics.completedTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employee.metrics.totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Present Days (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employee.metrics.presentDays} / 30</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Performance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={getPerformanceBadgeVariant(employee.metrics.performanceScore)} className="text-xl">
              {employee.metrics.performanceScore}%
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.assignedTasks.slice(0, 10).map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Link href={`/tasks/${task.id}`} className="text-blue-600 hover:underline">
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge>{task.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.attendances.map((attendance: any) => (
                  <TableRow key={attendance.id}>
                    <TableCell>{new Date(attendance.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(attendance.status)}>
                        {attendance.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {attendance.totalHours ? `${attendance.totalHours.toFixed(2)}h` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

