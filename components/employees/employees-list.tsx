'use client'

import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Users, MoreVertical, Trash2, UserCog } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createEmployee } from '@/app/actions/employee-actions'

interface Employee {
  id: string
  name: string
  email: string
  role: 'EMPLOYEE' | 'MANAGER' | 'SUPER_ADMIN'
  isActive: boolean
  metrics: {
    completedTasks: number
    totalTasks: number
    totalAttendance: number
    presentDays: number
    performanceScore: number
  }
}

export function EmployeesList() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'MANAGER',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'employees' | 'managers'>('all')

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setError('')
      const res = await fetch('/api/employees')
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `Failed to fetch: ${res.status}`)
      }
      const data = await res.json()
      console.log('Fetched employees data:', data)
      setEmployees(data.employees || [])
    } catch (err: any) {
      console.error('Failed to fetch employees:', err)
      setError(err.message || 'Failed to fetch employees. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await createEmployee({
        name: formData.name,
        email: formData.email,
        password: formData.password || undefined,
        role: formData.role,
      })
      
      setDialogOpen(false)
      resetForm()
      fetchEmployees()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'EMPLOYEE' | 'MANAGER') => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/employees/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }
      
      fetchEmployees()
    } catch (err: any) {
      setError(err.message || 'Failed to update role')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) {
      return
    }
    
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/employees/${userId}`, {
        method: 'DELETE',
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete user')
      }
      
      fetchEmployees()
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRestore = async (userId: string) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/employees/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to restore user')
      }
      
      fetchEmployees()
    } catch (err: any) {
      setError(err.message || 'Failed to restore user')
    } finally {
      setActionLoading(null)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'EMPLOYEE',
    })
    setError('')
  }

  const getPerformanceBadgeVariant = (score: number) => {
    if (score >= 80) return 'default'
    if (score >= 60) return 'secondary'
    return 'destructive'
  }

  // Filter employees based on active tab
  const filteredEmployees = activeTab === 'employees' 
    ? employees.filter(emp => emp.role === 'EMPLOYEE')
    : activeTab === 'managers'
    ? employees.filter(emp => emp.role === 'MANAGER')
    : employees

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new employee or manager to the system. Password will be auto-generated if left empty.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="john@techdr.in"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: 'EMPLOYEE' | 'MANAGER') => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="password">Password (Optional)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave empty to auto-generate"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If left empty, password will be auto-generated based on first name
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'employees' | 'managers')}>
              <TabsList>
                <TabsTrigger value="all">All Users</TabsTrigger>
                <TabsTrigger value="employees">Employees Only</TabsTrigger>
                <TabsTrigger value="managers">Managers Only</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed Tasks</TableHead>
                <TableHead>Total Tasks</TableHead>
                <TableHead>Attendance Days (30d)</TableHead>
                <TableHead>Performance Score</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {activeTab === 'employees' 
                          ? 'No employees found' 
                          : activeTab === 'managers'
                          ? 'No managers found'
                          : 'No users found'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activeTab === 'employees' 
                          ? 'Get started by creating a new employee'
                          : activeTab === 'managers'
                          ? 'Get started by creating a new manager'
                          : 'Get started by creating a new user'
                        }
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className={`hover:bg-muted/50 transition-colors ${!employee.isActive ? 'opacity-60' : ''}`}
                  >
                    <TableCell 
                      className="font-medium cursor-pointer"
                      onClick={() => router.push(`/employees/${employee.id}`)}
                    >
                      {employee.name}
                    </TableCell>
                    <TableCell 
                      onClick={() => router.push(`/employees/${employee.id}`)}
                      className="cursor-pointer"
                    >
                      {employee.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.role === 'MANAGER' ? 'default' : 'secondary'}>
                        {employee.role === 'MANAGER' ? 'Manager' : 'Employee'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.isActive ? 'default' : 'destructive'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell 
                      onClick={() => router.push(`/employees/${employee.id}`)}
                      className="cursor-pointer"
                    >
                      {employee.metrics.completedTasks}
                    </TableCell>
                    <TableCell 
                      onClick={() => router.push(`/employees/${employee.id}`)}
                      className="cursor-pointer"
                    >
                      {employee.metrics.totalTasks}
                    </TableCell>
                    <TableCell 
                      onClick={() => router.push(`/employees/${employee.id}`)}
                      className="cursor-pointer"
                    >
                      {employee.metrics.presentDays} / 30
                    </TableCell>
                    <TableCell 
                      onClick={() => router.push(`/employees/${employee.id}`)}
                      className="cursor-pointer"
                    >
                      <Badge variant={getPerformanceBadgeVariant(employee.metrics.performanceScore)}>
                        {employee.metrics.performanceScore}%
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={actionLoading === employee.id}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {employee.role === 'EMPLOYEE' ? (
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(employee.id, 'MANAGER')}
                              disabled={actionLoading === employee.id}
                            >
                              <UserCog className="h-4 w-4 mr-2" />
                              Make Manager
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(employee.id, 'EMPLOYEE')}
                              disabled={actionLoading === employee.id}
                            >
                              <UserCog className="h-4 w-4 mr-2" />
                              Make Employee
                            </DropdownMenuItem>
                          )}
                          {employee.isActive ? (
                            <DropdownMenuItem
                              onClick={() => handleDelete(employee.id)}
                              disabled={actionLoading === employee.id}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleRestore(employee.id)}
                              disabled={actionLoading === employee.id}
                            >
                              Restore
                            </DropdownMenuItem>
                          )}
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
    </div>
  )
}

