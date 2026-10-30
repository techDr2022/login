import { UserRole } from '@prisma/client'

export function canAccessRoute(userRole: UserRole, path: string): boolean {
  // Login page is accessible to everyone
  if (path === '/login') return true

  // All authenticated users can access other routes
  return true
}

export function canApproveTasks(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN
}

export function canCoordinate(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.COORDINATOR
}

function isStaff(userRole: UserRole): boolean {
  return (
    userRole === UserRole.SUPER_ADMIN ||
    userRole === UserRole.MANAGER ||
    userRole === UserRole.EMPLOYEE
  )
}

export function canManageClients(userRole: UserRole): boolean {
  return isStaff(userRole)
}

export function canEditClient(userRole: UserRole): boolean {
  return isStaff(userRole)
}

export function canCreateClient(userRole: UserRole): boolean {
  return isStaff(userRole)
}

export function canManageTasks(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN
}

export function canViewAllTasks(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.COORDINATOR
}

export const CLOCK_IN_ROLES: UserRole[] = [UserRole.EMPLOYEE, UserRole.COORDINATOR]

/** Staff who can sign in to the extension and create or receive tasks. */
export const EXTENSION_STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.MANAGER,
  UserRole.EMPLOYEE,
  UserRole.COORDINATOR,
]

export function canClockInOut(userRole: UserRole): boolean {
  return CLOCK_IN_ROLES.includes(userRole)
}

export function canAccessDesignerWorkspace(userRole: UserRole): boolean {
  return (
    userRole === UserRole.SUPER_ADMIN ||
    userRole === UserRole.MANAGER ||
    userRole === UserRole.EMPLOYEE
  )
}

export function canViewInvoices(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN
}
