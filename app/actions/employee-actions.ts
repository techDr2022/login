'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createEmployeeSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

/**
 * Extract first name from full name and convert to lowercase
 * Example: "Raviteja Pendari" -> "raviteja"
 */
function getFirstName(name: string): string {
  const firstName = name.trim().split(/\s+/)[0].toLowerCase()
  return firstName
}

/**
 * Generate password based on first name
 */
function generatePassword(name: string): string {
  return getFirstName(name)
}

export async function createEmployee(data: {
  name: string
  email: string
  password?: string
  role?: 'EMPLOYEE' | 'MANAGER'
}) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Forbidden')
  }

  const validated = createEmployeeSchema.parse(data)
  
  // Generate password if not provided or empty
  const password = (validated.password && validated.password.trim()) || generatePassword(validated.name)
  const passwordHash = await bcrypt.hash(password, 10)

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: validated.email },
  })

  if (existingUser) {
    throw new Error('Email already exists')
  }

  const role = data.role === 'MANAGER' ? UserRole.MANAGER : UserRole.EMPLOYEE

  const employee = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: validated.name,
      email: validated.email,
      passwordHash,
      role,
      isActive: true,
    },
  })

  await logActivity(session.user.id, 'CREATE', 'User', employee.id)

  return employee
}

export async function updateUserRole(userId: string, role: 'EMPLOYEE' | 'MANAGER') {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Forbidden')
  }

  // Prevent changing own role
  if (session.user.id === userId) {
    throw new Error('Cannot change your own role')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Prevent changing super admin role
  if (user.role === UserRole.SUPER_ADMIN) {
    throw new Error('Cannot change super admin role')
  }

  const newRole = role === 'MANAGER' ? UserRole.MANAGER : UserRole.EMPLOYEE

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  })

  await logActivity(session.user.id, 'UPDATE', 'User', updatedUser.id)

  return updatedUser
}

export async function deleteUser(userId: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Forbidden')
  }

  // Prevent deleting self
  if (session.user.id === userId) {
    throw new Error('Cannot delete your own account')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Prevent deleting super admin
  if (user.role === UserRole.SUPER_ADMIN) {
    throw new Error('Cannot delete super admin account')
  }

  // Soft delete by setting isActive to false
  const deletedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  })

  await logActivity(session.user.id, 'DELETE', 'User', deletedUser.id)

  return deletedUser
}

export async function restoreUser(userId: string) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')

  if (session.user.role !== UserRole.SUPER_ADMIN) {
    throw new Error('Forbidden')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('User not found')
  }

  const restoredUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  })

  await logActivity(session.user.id, 'UPDATE', 'User', restoredUser.id)

  return restoredUser
}

