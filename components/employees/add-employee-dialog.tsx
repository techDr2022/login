'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, Copy, AlertCircle } from 'lucide-react'
import { UserRole } from '@prisma/client'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  joiningDate: string | null
  adminNotes?: string | null
}

interface AddEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
  onSuccess: () => void
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: AddEmployeeDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'EMPLOYEE' as UserRole,
    password: '',
    confirmPassword: '',
    joiningDate: new Date().toISOString().split('T')[0],
    adminNotes: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)
  const [passwordGenerated, setPasswordGenerated] = useState(false)

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name,
        email: employee.email,
        role: employee.role as UserRole,
        password: '',
        confirmPassword: '',
        joiningDate: employee.joiningDate
          ? new Date(employee.joiningDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        adminNotes: employee.adminNotes || '',
      })
      setPasswordGenerated(false)
    } else {
      resetForm()
    }
  }, [employee, open])

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'EMPLOYEE',
      password: '',
      confirmPassword: '',
      joiningDate: new Date().toISOString().split('T')[0],
      adminNotes: '',
    })
    setError('')
    setCredentials(null)
    setPasswordGenerated(false)
  }

  const generatePassword = () => {
    const length = 12
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    setFormData({ ...formData, password, confirmPassword: password })
    setPasswordGenerated(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.name || !formData.email || !formData.role) {
      setError('Please fill in all required fields')
      return
    }

    if (!employee && (!formData.password || !formData.confirmPassword)) {
      setError('Password is required for new employees')
      return
    }

    if (!employee && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!employee && formData.password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      if (employee) {
        // Update existing employee
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          joiningDate: formData.joiningDate,
          adminNotes: formData.adminNotes || null,
        }

        const res = await fetch(`/api/admin/employees/${employee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to update employee')
        }

        onSuccess()
      } else {
        // Create new employee
        const res = await fetch('/api/admin/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            password: formData.password,
            joiningDate: formData.joiningDate,
            adminNotes: formData.adminNotes || null,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create employee')
        }

        const data = await res.json()
        setCredentials(data.credentials)
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          resetForm()
        }
        onOpenChange(open)
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
          <DialogDescription>
            {employee
              ? 'Update employee information'
              : 'Create a new employee account. Login credentials will be generated automatically.'}
          </DialogDescription>
        </DialogHeader>

        {credentials && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="mt-2">
              <p className="font-semibold text-green-800 mb-2">Employee created successfully!</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-mono text-sm">{credentials.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(credentials.email)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div>
                    <p className="text-xs text-muted-foreground">Password</p>
                    <p className="font-mono text-sm">{credentials.password}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(credentials.password)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Please save these credentials. They will not be shown again.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                required
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="joiningDate">Joining Date</Label>
              <DatePicker
                date={formData.joiningDate ? new Date(formData.joiningDate) : null}
                onSelect={(date) =>
                  setFormData({
                    ...formData,
                    joiningDate: date ? date.toISOString().split('T')[0] : '',
                  })
                }
                placeholder="Select joining date"
              />
            </div>
          </div>

          {!employee && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generatePassword}
                    className="rounded-xl"
                  >
                    Generate Password
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="rounded-xl"
                />
                {passwordGenerated && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Password generated automatically
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="confirmPassword">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  required
                  className="rounded-xl"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="adminNotes">Admin Notes (Internal)</Label>
            <Textarea
              id="adminNotes"
              value={formData.adminNotes}
              onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
              placeholder="Add internal notes about this employee..."
              className="rounded-xl"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
              disabled={loading}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl">
              {loading ? 'Saving...' : employee ? 'Update Employee' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

