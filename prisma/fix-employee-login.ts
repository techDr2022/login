import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

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
  console.log('🔍 Diagnosing employee login issues...\n')

  // Find all employees
  const employees = await prisma.user.findMany({
    where: {
      role: UserRole.EMPLOYEE,
    },
    orderBy: { name: 'asc' },
  })

  if (employees.length === 0) {
    console.log('❌ No employees found in the database.')
    return
  }

  console.log(`Found ${employees.length} employee(s).\n`)

  const issues: Array<{
    name: string
    email: string
    issue: string
    fixed: boolean
  }> = []

  // Check each employee
  for (const employee of employees) {
    const expectedEmail = generateEmail(employee.name)
    const expectedPassword = generatePassword(employee.name)
    
    console.log(`Checking: ${employee.name}`)
    console.log(`  Current email: ${employee.email}`)
    console.log(`  Expected email: ${expectedEmail}`)
    console.log(`  Expected password: ${expectedPassword}`)
    console.log(`  isActive: ${employee.isActive}`)

    // Test password
    let passwordMatches = false
    try {
      passwordMatches = await bcrypt.compare(expectedPassword, employee.passwordHash)
    } catch (error) {
      console.log(`  ⚠️  Error checking password: ${error}`)
    }

    console.log(`  Password matches: ${passwordMatches}`)

    const problems: string[] = []
    
    if (!employee.isActive) {
      problems.push('User is inactive')
    }
    
    if (employee.email !== expectedEmail) {
      problems.push(`Email mismatch (current: ${employee.email}, expected: ${expectedEmail})`)
    }
    
    if (!passwordMatches) {
      problems.push('Password does not match expected password')
    }

    if (problems.length > 0) {
      console.log(`  ❌ Issues found: ${problems.join(', ')}`)
      
      // Fix the issues
      console.log(`  🔧 Fixing issues...`)
      
      const updateData: any = {}
      
      if (employee.email !== expectedEmail) {
        updateData.email = expectedEmail
      }
      
      if (!passwordMatches) {
        updateData.passwordHash = await bcrypt.hash(expectedPassword, 10)
      }
      
      if (!employee.isActive) {
        updateData.isActive = true
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: employee.id },
          data: updateData,
        })
        console.log(`  ✅ Fixed!`)
        issues.push({
          name: employee.name,
          email: expectedEmail,
          issue: problems.join(', '),
          fixed: true,
        })
      }
    } else {
      console.log(`  ✅ No issues found`)
    }

    console.log('')
  }

  if (issues.length > 0) {
    console.log('\n📋 Summary of fixes:')
    issues.forEach((issue) => {
      console.log(`  ✓ ${issue.name} (${issue.email}) - ${issue.issue}`)
    })
    console.log('\n✅ All issues have been fixed!')
  } else {
    console.log('\n✅ No issues found. All employees should be able to login.')
  }

  // Test login for one employee as verification
  console.log('\n🧪 Testing login for first employee...')
  if (employees.length > 0) {
    const testEmployee = employees[0]
    const testEmail = generateEmail(testEmployee.name)
    const testPassword = generatePassword(testEmployee.name)
    
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    })
    
    if (user) {
      const isValid = await bcrypt.compare(testPassword, user.passwordHash)
      if (isValid && user.isActive) {
        console.log(`✅ Login test successful for ${testEmployee.name}`)
        console.log(`   Email: ${testEmail}`)
        console.log(`   Password: ${testPassword}`)
      } else {
        console.log(`❌ Login test failed for ${testEmployee.name}`)
      }
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Error fixing employee login:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

