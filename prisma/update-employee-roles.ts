import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Employee roles mapping - full name to job title
const employeeRoles: Array<{
  name: string
  jobTitle: string
  department: string
  email?: string
}> = [
  { name: 'Chaithanya', jobTitle: 'Graphic Designer', department: 'Graphic Design' },
  { name: 'Rohith', jobTitle: 'Video Editor', department: 'Video Editing' },
  { name: 'Raghu', jobTitle: 'Web Developer', department: 'Website Development' },
  { name: 'Gowthami', jobTitle: 'Digital Marketing Executive', department: 'Marketing' },
  { name: 'Jagadeesh', jobTitle: 'Digital Marketing Executive', department: 'Marketing' },
  { name: 'Shaheena', jobTitle: 'Content Writer', department: 'Content Writing' },
  { name: 'Shiva Prasad', jobTitle: 'Full Stack Developer', department: 'Website Development' },
]

function generateEmail(name: string): string {
  const firstName = name.split(' ')[0].toLowerCase()
  return `${firstName}@techdr.in`
}

function generatePassword(name: string): string {
  return name.split(' ')[0]
}

async function main() {
  console.log('Updating/Creating employees with their roles...\n')

  let updatedCount = 0
  let createdCount = 0
  let errorCount = 0

  for (const employeeData of employeeRoles) {
    try {
      const { name, jobTitle, department, email } = employeeData
      const employeeEmail = email || generateEmail(name)

      // Try to find employee by name (case-insensitive, partial match) or email
      const existingEmployee = await prisma.user.findFirst({
        where: {
          OR: [
            {
              name: {
                contains: name,
                mode: 'insensitive',
              },
            },
            {
              email: {
                equals: employeeEmail,
                mode: 'insensitive',
              },
            },
          ],
          role: {
            in: [UserRole.EMPLOYEE, UserRole.MANAGER],
          },
        },
      })

      if (existingEmployee) {
        // Update existing employee
        await prisma.user.update({
          where: { id: existingEmployee.id },
          data: { jobTitle, department },
        })
        console.log(`✓ Updated ${existingEmployee.name} → ${department} / ${jobTitle}`)
        updatedCount++
      } else {
        // Create new employee
        const password = generatePassword(name)
        const passwordHash = await bcrypt.hash(password, 10)

        const newEmployee = await prisma.user.create({
          data: {
            id: crypto.randomUUID(),
            name,
            email: employeeEmail,
            passwordHash,
            role: UserRole.EMPLOYEE,
            jobTitle,
            department,
            isActive: true,
            joiningDate: new Date(),
          },
        })
        console.log(`✓ Created ${newEmployee.name} → ${department} / ${jobTitle}`)
        console.log(`  Email: ${employeeEmail}`)
        console.log(`  Password: ${password}`)
        createdCount++
      }
    } catch (error: any) {
      console.error(`✗ Error processing ${employeeData.name}:`, error.message)
      errorCount++
    }
  }

  console.log(`\n✅ Process complete!`)
  console.log(`   Created: ${createdCount}`)
  console.log(`   Updated: ${updatedCount}`)
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

