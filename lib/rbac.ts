import { UserRole } from '@prisma/client'

export function canAccessRoute(userRole: UserRole, path: string): boolean {
  // Login page is accessible to everyone
  if (path === '/login') return true

  // Employees cannot access /employees
  if (path.startsWith('/employees') && userRole === UserRole.EMPLOYEE) {
    return false
  }

  // All authenticated users can access other routes
  return true
}

export function canApproveTasks(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.MANAGER
}

export function canManageClients(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.MANAGER
}

export function canManageTasks(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.MANAGER
}

export function canViewAllTasks(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.MANAGER
}

export function canClockInOut(userRole: UserRole): boolean {
  return userRole === UserRole.EMPLOYEE
}

