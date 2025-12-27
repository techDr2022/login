'use client'

import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Edit, Trash2, Eye, AlertTriangle, Zap, CheckCircle2, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  joiningDate: string | null
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  performanceScore: number
}

interface EmployeesTableProps {
  employees: Employee[]
  loading: boolean
  onEmployeeClick: (employee: Employee) => void
  onEdit: (employee: Employee) => void
  onDelete: () => void
  showTodayOnly?: boolean
}

export function EmployeesTable({
  employees,
  loading,
  onEmployeeClick,
  onEdit,
  onDelete,
  showTodayOnly,
}: EmployeesTableProps) {
  const [todayTasks, setTodayTasks] = useState<Record<string, any[]>>({})

  useEffect(() => {
    if (showTodayOnly) {
      fetchTodayTasks()
    }
  }, [showTodayOnly, employees])

  const fetchTodayTasks = async () => {
    try {
      const tasksByEmployee: Record<string, any[]> = {}
      for (const employee of employees) {
        const res = await fetch(
          `/api/admin/tasks?employeeId=${employee.id}&todayOnly=true`
        )
        const data = await res.json()
        tasksByEmployee[employee.id] = data.tasks || []
      }
      setTodayTasks(tasksByEmployee)
    } catch (error) {
      console.error('Failed to fetch today tasks:', error)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20'
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20'
    return 'bg-red-100 dark:bg-red-900/20'
  }

  const getStatusBadge = (employee: Employee) => {
    if (employee.overdueTasks > 5) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          At Risk
        </Badge>
      )
    }
    if (employee.pendingTasks > 10) {
      return (
        <Badge variant="default" className="gap-1 bg-orange-500">
          <Zap className="h-3 w-3" />
          Overloaded
        </Badge>
      )
    }
    if (employee.pendingTasks < 3 && employee.overdueTasks === 0) {
      return (
        <Badge variant="outline" className="gap-1 border-green-500 text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Available
        </Badge>
      )
    }
    return null
  }

  const handleDelete = async (employee: Employee) => {
    console.log('handleDelete called for employee:', employee.id, employee.name)
    
    const action = employee.isActive ? 'deactivate' : 'permanently delete'
    const confirmed = confirm(`Are you sure you want to ${action} ${employee.name}?`)
    
    if (!confirmed) {
      console.log('Delete cancelled by user')
      return
    }

    console.log('Delete confirmed, calling API...')

    try {
      // If employee is inactive, permanently delete them; otherwise just deactivate
      const hardDelete = !employee.isActive
      const url = `/api/admin/employees/${employee.id}${hardDelete ? '?hard=true' : ''}`
      console.log('DELETE request to:', url)
      
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      console.log('Response status:', res.status, res.statusText)
      
      if (!res.ok) {
        const data = await res.json()
        console.error('Delete failed:', data)
        throw new Error(data.error || 'Failed to delete employee')
      }

      const result = await res.json()
      console.log('Delete result:', result)
      
      if (result.success) {
        // Show success message
        console.log(result.message || 'Employee deleted successfully')
        // Refresh the list
        onDelete()
      } else {
        throw new Error('Delete operation did not succeed')
      }
    } catch (error: any) {
      console.error('Failed to delete employee:', error)
      alert(error.message || 'Failed to delete employee. Please try again.')
    }
  }

  if (loading) {
    return (
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading employees...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead>Performance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm font-medium text-muted-foreground">No employees found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Get started by adding a new employee
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onEmployeeClick(employee)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-sm text-muted-foreground">{employee.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{employee.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {getStatusBadge(employee)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{employee.totalTasks}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-medium">
                        {employee.completedTasks}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-yellow-600 font-medium">
                      {employee.pendingTasks}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-red-600 font-medium">
                      {employee.overdueTasks}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${getPerformanceColor(employee.performanceScore)}`}
                        >
                          {employee.performanceScore}
                        </span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                      <Progress
                        value={employee.performanceScore}
                        className="h-2"
                      />
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEmployeeClick(employee)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(employee)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            handleDelete(employee)
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {employee.isActive ? 'Deactivate' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

