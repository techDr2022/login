import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

/**
 * Extract first name from full name and convert to lowercase
 * Example: "Raviteja Pendari" -> "raviteja"
 */
function getFirstName(name: string): string {
  const firstName = name.trim().split(/\s+/)[0].toLowerCase()
  return firstName
}

/**
 * Generate email in format: firstname@techdr.in
 */
function generateEmail(name: string): string {
  const firstName = getFirstName(name)
  return `${firstName}@techdr.in`
}

/**
 * Generate password as lowercase first name
 * Example: "Raviteja Pendari" -> "raviteja"
 */
function generatePassword(name: string): string {
  return getFirstName(name)
}

async function main() {
  console.log('Fetching all employees...\n')

  // Find all employees
  const employees = await prisma.user.findMany({
    where: {
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  })

  if (employees.length === 0) {
    console.log('No employees found in the database.')
    return
  }

  console.log(`Found ${employees.length} employee(s). Generating credentials...\n`)

  const credentials: Array<{
    name: string
    email: string
    password: string
  }> = []

  // Update email and password for each employee
  for (const employee of employees) {
    const email = generateEmail(employee.name)
    const password = generatePassword(employee.name)
    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: employee.id },
      data: { 
        email,
        passwordHash,
      },
    })

    credentials.push({
      name: employee.name,
      email,
      password,
    })

    console.log(`✓ ${employee.name}`)
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password}\n`)
  }

  // Save credentials to a file
  const credentialsPath = path.join(process.cwd(), 'employee-credentials.txt')
  const credentialsContent = [
    '='.repeat(60),
    'EMPLOYEE LOGIN CREDENTIALS',
    '='.repeat(60),
    `Generated on: ${new Date().toLocaleString()}`,
    `Total Employees: ${credentials.length}`,
    '='.repeat(60),
    '',
    ...credentials.map((cred, index) => {
      return [
        `${index + 1}. ${cred.name}`,
        `   Email: ${cred.email}`,
        `   Password: ${cred.password}`,
        '',
      ].join('\n')
    }),
    '='.repeat(60),
    'NOTE: Store this file securely and delete it after distributing credentials.',
    '='.repeat(60),
  ].join('\n')

  fs.writeFileSync(credentialsPath, credentialsContent, 'utf-8')

  console.log(`\n✅ Successfully created credentials for ${credentials.length} employee(s)!`)
  console.log(`📄 Credentials saved to: ${credentialsPath}`)
  console.log('\n⚠️  IMPORTANT: Keep this file secure and delete it after distributing credentials to employees.')
}

main()
  .catch((e) => {
    console.error('Error creating employee credentials:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

