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

export function canManageClients(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN
}

export function canCreateClient(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.EMPLOYEE
}

export function canManageTasks(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN
}

export function canViewAllTasks(userRole: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN
}

export function canClockInOut(userRole: UserRole): boolean {
  return userRole === UserRole.EMPLOYEE
}

