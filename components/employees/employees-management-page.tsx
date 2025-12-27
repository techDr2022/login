'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BestPerformersSection } from './best-performers-section'
import { EmployeesTable } from './employees-table'
import { AddEmployeeDialog } from './add-employee-dialog'
import { EmployeeDetailDrawer } from './employee-detail-drawer'
import { Search, Plus, Users, Filter } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

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

export function EmployeesManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showTodayOnly, setShowTodayOnly] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [statusFilter, roleFilter])

  useEffect(() => {
    // Filter employees based on search
    let filtered = employees

    if (search) {
      filtered = filtered.filter(
        (emp) =>
          emp.name.toLowerCase().includes(search.toLowerCase()) ||
          emp.email.toLowerCase().includes(search.toLowerCase())
      )
    }

    setFilteredEmployees(filtered)
  }, [search, employees])

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (roleFilter !== 'all') {
        params.append('role', roleFilter)
      }

      const res = await fetch(`/api/admin/employees?${params}`)
      const data = await res.json()
      setEmployees(data.employees || [])
      setFilteredEmployees(data.employees || [])
    } catch (error) {
      console.error('Failed to fetch employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployee(employee)
    setDrawerOpen(true)
  }

  const handleAddEmployee = () => {
    setEditingEmployee(null)
    setDialogOpen(true)
  }

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee)
    setDialogOpen(true)
  }

  const handleEmployeeUpdated = () => {
    fetchEmployees()
    setDialogOpen(false)
    setEditingEmployee(null)
  }

  const handleEmployeeDeleted = () => {
    fetchEmployees()
    setDrawerOpen(false)
    setSelectedEmployee(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">Super Admin Control Panel</p>
        <h1 className="text-2xl font-semibold">Employees Management</h1>
      </div>

      {/* Best Performers Section */}
      <BestPerformersSection />

      {/* Filters and Actions */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search employees by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="todayOnly"
                checked={showTodayOnly}
                onCheckedChange={(checked) => setShowTodayOnly(checked === true)}
              />
              <Label htmlFor="todayOnly" className="text-sm cursor-pointer">
                Today&apos;s Tasks
              </Label>
            </div>
            <Button onClick={handleAddEmployee} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <EmployeesTable
        employees={filteredEmployees}
        loading={loading}
        onEmployeeClick={handleEmployeeClick}
        onEdit={handleEditEmployee}
        onDelete={handleEmployeeDeleted}
        showTodayOnly={showTodayOnly}
      />

      {/* Employee Detail Drawer */}
      <EmployeeDetailDrawer
        employee={selectedEmployee}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={handleEditEmployee}
        onDelete={handleEmployeeDeleted}
      />

      {/* Add/Edit Employee Dialog */}
      <AddEmployeeDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingEmployee(null)
        }}
        employee={editingEmployee}
        onSuccess={handleEmployeeUpdated}
      />
    </div>
  )
}

