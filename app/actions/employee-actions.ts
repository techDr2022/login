'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createEmployeeSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

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

  const employee = await prisma.user.create({
    data: {
      name: validated.name,
      email: validated.email,
      passwordHash,
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  await logActivity(session.user.id, 'CREATE', 'User', employee.id)

  return employee
}

