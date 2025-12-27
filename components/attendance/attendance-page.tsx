'use client'

import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { SuperAdminAttendancePanel } from './super-admin-attendance-panel'

export function AttendancePage() {
  const { data: session } = useSession()
  const isSuperAdmin = session?.user.role === UserRole.SUPER_ADMIN

  // Show super admin panel for super admins
  if (isSuperAdmin) {
    return <SuperAdminAttendancePanel />
  }

  // Return empty for non-super admins (shouldn't happen with proper auth)
  return null
}
