'use client'

import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { SuperAdminAttendancePanel } from './super-admin-attendance-panel'
import { EmployeeAttendancePanel } from './employee-attendance-panel'

export function AttendancePage() {
  const { data: session } = useSession()
  const role = session?.user.role as UserRole

  // Show super admin panel for super admins
  if (role === UserRole.SUPER_ADMIN) {
    return <SuperAdminAttendancePanel />
  }

  // Show employee panel for employees
  if (role === UserRole.EMPLOYEE) {
    return <EmployeeAttendancePanel />
  }

  // Return empty for other roles (shouldn't happen with proper auth)
  return null
}
