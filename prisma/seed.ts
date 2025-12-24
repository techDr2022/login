import { PrismaClient, UserRole, AttendanceStatus, TaskPriority, TaskStatus, ChatThreadType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Simple encryption for seed data (matches lib/encryption.ts)
function encrypt(value: string): string {
  if (!value) return value
  const ALGORITHM = 'aes-256-gcm'
  const IV_LENGTH = 16
  const KEY_LENGTH = 32
  const key = crypto.scryptSync('default-key-change-in-production', 'salt', KEY_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(value, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted
}

const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.chatUnreadCount.deleteMany()
  await prisma.chatMessage.deleteMany()
  await prisma.chatThread.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.task.deleteMany()
  await prisma.client.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await bcrypt.hash('password123', 10)

  // Create Super Admins
  const superAdmin1 = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Raviteja Pendari',
      email: 'raviteja@techdr.in',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
  })

  const superAdmin2 = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Abhista',
      email: 'abhista@techdr.in',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
  })

  // Create Employees
  const employeeData = [
    { name: 'Gouthami', email: 'gouthami@techdr.in', role: 'Social Media Manager' },
    { name: 'Jagadeesh', email: 'jagadeesh@techdr.in', role: 'Social Media Manager' },
    { name: 'Shaheena', email: 'shaheena@techdr.in', role: 'Content Writer' },
    { name: 'Rohith', email: 'rohith@techdr.in', role: 'Graphic Designer' },
    { name: 'Chaithanya', email: 'chaithanya@techdr.in', role: 'Graphic Designer' },
    { name: 'Shiva Prasad', email: 'shivaprasad@techdr.in', role: 'Full Stack Developer' },
    { name: 'Raghu', email: 'raghu@techdr.in', role: 'Full Stack Developer' },
  ]

  const employees = []
  for (const empData of employeeData) {
    const emp = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name: empData.name,
        email: empData.email,
        passwordHash,
        role: UserRole.EMPLOYEE,
      },
    })
    employees.push(emp)
  }

  // Create Clients (Real Client List)
  const clientData = [
    { name: 'Samanwi Clinics', doctorOrHospitalName: 'Samanwi Clinics', location: 'Hyderabad' },
    { name: 'Lk Hospital', doctorOrHospitalName: 'Lk Hospital', location: 'Hyderabad' },
    { name: 'Ab Skin', doctorOrHospitalName: 'Ab Skin', location: 'Hyderabad' },
    { name: 'AVNI Fertility Center', doctorOrHospitalName: 'AVNI Fertility Center', location: 'Hyderabad' },
    { name: 'Dr Avani Reddy', doctorOrHospitalName: 'Dr Avani Reddy', location: 'Hyderabad' },
    { name: 'Dr SK Gupta', doctorOrHospitalName: 'Dr SK Gupta', location: 'Hyderabad' },
    { name: 'Ragas Clinic', doctorOrHospitalName: 'Ragas Clinic', location: 'Hyderabad' },
    { name: 'Dr. Prithivi Perum', doctorOrHospitalName: 'Dr. Prithivi Perum', location: 'Hyderabad' },
    { name: 'Dr Azadh Chandrashekar', doctorOrHospitalName: 'Dr Azadh Chandrashekar', location: 'Hyderabad' },
    { name: 'Orene Clinics', doctorOrHospitalName: 'Orene Clinics', location: 'Hyderabad' },
    { name: 'Divya Skin Clinic', doctorOrHospitalName: 'Divya Skin Clinic', location: 'Hyderabad' },
    { name: 'Dr Kiran Gastro', doctorOrHospitalName: 'Dr Kiran Gastro', location: 'Hyderabad' },
    { name: 'NEUMED CLINICS', doctorOrHospitalName: 'NEUMED CLINICS', location: 'Hyderabad' },
    { name: 'Kindle Clinics', doctorOrHospitalName: 'Kindle Clinics', location: 'Hyderabad' },
    { name: 'Dr. Srikanth', doctorOrHospitalName: 'Dr. Srikanth', location: 'Hyderabad' },
    { name: 'Dr. Priyanka Gupta', doctorOrHospitalName: 'Dr. Priyanka Gupta', location: 'Hyderabad' },
    { name: 'JJ Hospital', doctorOrHospitalName: 'JJ Hospital', location: 'Hyderabad' },
    { name: 'Dr Rakesh Gastro', doctorOrHospitalName: 'Dr Rakesh Gastro', location: 'Hyderabad' },
    { name: 'Dr Sameera', doctorOrHospitalName: 'Dr Sameera', location: 'Hyderabad' },
    { name: 'Dr. Sruthi Reddy Chada', doctorOrHospitalName: 'Dr. Sruthi Reddy Chada', location: 'Hyderabad' },
    { name: 'Avila Clinic', doctorOrHospitalName: 'Avila Clinic', location: 'Hyderabad' },
    { name: 'Dr Sravani Reddy', doctorOrHospitalName: 'Dr Sravani Reddy', location: 'Hyderabad' },
    { name: 'Regen', doctorOrHospitalName: 'Regen', location: 'Hyderabad' },
    { name: 'S&S Clinics', doctorOrHospitalName: 'S&S Clinics', location: 'Hyderabad' },
    { name: 'Dr Keerthana', doctorOrHospitalName: 'Dr Keerthana', location: 'Hyderabad' },
    { name: 'Dr Stitha Praganna', doctorOrHospitalName: 'Dr Stitha Praganna', location: 'Hyderabad' },
    { name: 'Vijaya Trauma', doctorOrHospitalName: 'Vijaya Trauma', location: 'Hyderabad' },
    { name: 'Dr Venu Bhargava Mulpuri', doctorOrHospitalName: 'Dr Venu Bhargava Mulpuri', location: 'Hyderabad' },
    { name: 'Dr Anusha', doctorOrHospitalName: 'Dr Anusha', location: 'Hyderabad' },
    { name: 'Dr Anupama', doctorOrHospitalName: 'Dr Anupama', location: 'Hyderabad' },
    { name: 'Dr Ranjith', doctorOrHospitalName: 'Dr Ranjith', location: 'Hyderabad' },
    { name: 'Dr Nagateja', doctorOrHospitalName: 'Dr Nagateja', location: 'Hyderabad' },
    { name: 'The Tooth Studio', doctorOrHospitalName: 'The Tooth Studio', location: 'Hyderabad' },
    { name: 'Dr Padmaja', doctorOrHospitalName: 'Dr Padmaja', location: 'Hyderabad' },
    { name: 'Dr Jasmin Rath', doctorOrHospitalName: 'Dr Jasmin Rath', location: 'Hyderabad' },
    { name: 'Pallavi Reddy', doctorOrHospitalName: 'Pallavi Reddy', location: 'Hyderabad' },
    { name: 'Dharani Hospital', doctorOrHospitalName: 'Dharani Hospital', location: 'Hyderabad' },
    { name: 'Dr Jagdish Pusa', doctorOrHospitalName: 'Dr Jagdish Pusa', location: 'Hyderabad' },
    { name: 'New Lotus Hospital', doctorOrHospitalName: 'New Lotus Hospital', location: 'Hyderabad' },
    { name: 'Dr Sravya Buggana', doctorOrHospitalName: 'Dr Sravya Buggana', location: 'Hyderabad' },
  ]

  const services = ['Consultation', 'Surgery', 'Diagnostics', 'Treatment', 'Follow-up', 'Emergency Care', 'Social Media Management', 'Content Creation', 'Graphic Design', 'Website Development']

  const clients = []

  // Define dedicated account managers for clients
  const accountManagerNames = ['Gouthami', 'Jagadeesh', 'Shaheena']
  const accountManagers = employees.filter((e) => accountManagerNames.includes(e.name))
  for (let i = 0; i < clientData.length; i++) {
    const clientInfo = clientData[i]
    
    // Assign services based on client type
    const clientServices = []
    const numServices = Math.floor(Math.random() * 3) + 2 // 2-4 services
    for (let j = 0; j < numServices; j++) {
      clientServices.push(services[Math.floor(Math.random() * services.length)])
    }

    // Rotate between the defined account managers
    const accountManager = accountManagers[i % accountManagers.length]

    const client = await prisma.client.create({
      data: {
        id: crypto.randomUUID(),
        name: clientInfo.name,
        doctorOrHospitalName: clientInfo.doctorOrHospitalName,
        location: clientInfo.location,
        services: clientServices,
        accountManagerId: accountManager?.id,
      },
    })
    clients.push(client)
  }

  // Create 30 Tasks
  const tasks = []
  const priorities = [TaskPriority.Low, TaskPriority.Medium, TaskPriority.High, TaskPriority.Urgent]
  const taskStatuses = [TaskStatus.Pending, TaskStatus.InProgress, TaskStatus.Review, TaskStatus.Approved, TaskStatus.Rejected]
  
  for (let i = 0; i < 30; i++) {
    const client = clients[i % clients.length]
    const assignedTo = employees[i % employees.length]
    const assignedBy = i % 2 === 0 ? superAdmin1 : superAdmin2
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 30))

    const task = await prisma.task.create({
      data: {
        id: crypto.randomUUID(),
        title: `Task ${i + 1}: ${client.name}`,
        description: `Task description for client ${client.name}`,
        priority: priorities[i % priorities.length],
        status: taskStatuses[i % taskStatuses.length],
        assignedById: assignedBy.id,
        assignedToId: assignedTo.id,
        clientId: client.id,
        dueDate,
        timeSpent: Math.random() * 10,
      },
    })
    tasks.push(task)
  }

  // Create 7 days of attendance records
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(today)
    date.setDate(date.getDate() - dayOffset)
    
    for (const employee of employees) {
      const hasAttendance = Math.random() > 0.2 // 80% attendance rate
      if (hasAttendance) {
        const loginTime = new Date(date)
        loginTime.setHours(9 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0)
        
        const isLate = loginTime.getHours() > 9 || (loginTime.getHours() === 9 && loginTime.getMinutes() > 30)
        const logoutTime = new Date(loginTime)
        logoutTime.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0)
        
        const totalHours = (logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)

        await prisma.attendance.create({
          data: {
            id: crypto.randomUUID(),
            userId: employee.id,
            date,
            loginTime,
            logoutTime,
            totalHours,
            status: isLate ? AttendanceStatus.Late : AttendanceStatus.Present,
          },
        })
      }
    }
  }

  // Create a TEAM chat thread
  const teamThread = await prisma.chatThread.create({
    data: {
      id: crypto.randomUUID(),
      type: ChatThreadType.TEAM,
    },
  })

  // Create a sample client with full onboarding data
  const sampleClient = await prisma.client.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Sample Medical Clinic',
      doctorOrHospitalName: 'Dr. Sample Clinic',
      location: 'Hyderabad',
      services: ['Consultation', 'General Medicine'],
      type: 'CLINIC' as any,
      status: 'ONBOARDING' as any,
      primaryContactName: 'Dr. Sample',
      phonePrimary: '+91 9876543210',
      phoneWhatsApp: '+91 9876543210',
      email: 'sample@clinic.com',
      addressLine: '123 Main Street',
      area: 'Hitech City',
      city: 'Hyderabad',
      pincode: '500081',
      googleMapLink: 'https://maps.google.com/?q=Hyderabad',
      workingDays: [1, 2, 3, 4, 5],
      workingTimings: '9:00 AM - 6:00 PM',
      preferredLanguage: 'BOTH' as any,
      // Assign a default account manager from the dedicated list
      accountManagerId: accountManagers[0]?.id,
    },
  })

  // Add doctors
  await prisma.clientDoctor.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      fullName: 'Dr. Sample Doctor',
      qualification: 'MBBS, MD',
      specialization: 'General Medicine',
      experienceYears: 10,
      registrationNumber: 'REG123456',
      languagesSpoken: ['English', 'Telugu'],
    },
  })

  // Add services
  await prisma.clientService.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      name: 'General Consultation',
      isPriority: true,
      priorityRank: 1,
    },
  })

  await prisma.clientService.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      name: 'Health Checkup',
      isPriority: false,
    },
  })

  // Add USPs
  await prisma.clientUSP.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      uspText: 'Experienced doctors with modern facilities',
    },
  })

  // Add access credentials
  await prisma.clientAccess.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      type: 'GMB' as any,
      loginUrl: 'https://business.google.com',
      username: 'sample@gmail.com',
      passwordEncrypted: encrypt('samplepassword123'),
      notes: 'GMB account for clinic',
    },
  })

  // Add branding
  await prisma.clientBranding.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      updatedAt: new Date(),
      brandColors: {
        primary: '#0066CC',
        secondary: '#00CC66',
        accent: '#FF6600',
      },
      designerName: 'Design Team',
      templateBaseCreated: true,
    },
  })

  // Add targeting
  await prisma.clientTargeting.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      updatedAt: new Date(),
      primaryLocation: 'Hitech City, Hyderabad',
      nearbyAreas: ['Gachibowli', 'Madhapur', 'Kondapur'],
      mainKeywords: ['general medicine', 'clinic', 'doctor'],
      exampleKeywords: ['best doctor in hitech city', 'clinic near me'],
    },
  })

  // Add competitors
  await prisma.clientCompetitor.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      name: 'Competitor Clinic A',
      googleMapLink: 'https://maps.google.com/?q=Competitor+Clinic',
    },
  })

  // Add marketing requirements
  await prisma.clientMarketingRequirement.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      updatedAt: new Date(),
      gmbOptimisation: true,
      websiteSeo: true,
      socialPostsPerWeek: 5,
      socialPostsPerMonth: 20,
      reelsPerMonth: 4,
      googleAds: false,
      metaAds: true,
      reviewManagement: true,
      posters: true,
      videos: false,
      notes: 'Focus on social media presence',
    },
  })

  // Add approval settings
  await prisma.clientApprovalSettings.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      updatedAt: new Date(),
      pointOfContactName: 'Dr. Sample',
      approvalTimeHours: 24,
      approvalMode: 'WHATSAPP' as any,
      performanceTrackingMode: 'MANUAL' as any,
    },
  })

  // Add KPI for current month
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  await prisma.clientKpiMonthly.create({
    data: {
      id: crypto.randomUUID(),
      clientId: sampleClient.id,
      month: currentMonth,
      updatedAt: new Date(),
      gmbCalls: 50,
      directionRequests: 30,
      websiteClicks: 200,
      leadsGenerated: 15,
      reportStatus: 'PENDING' as any,
    },
  })

  console.log('Seed data created successfully!')
  console.log(`- 2 Super Admins: Raviteja, Abhista`)
  console.log(`- 7 Employees:`)
  console.log(`  * Social Media Managers: Gouthami, Jagadeesh`)
  console.log(`  * Content Writer: Shaheena`)
  console.log(`  * Graphic Designers: Rohith, Chaithanya`)
  console.log(`  * Full Stack Developers: Shiva Prasad, Raghu`)
  console.log(`- ${clients.length} Real Clients (Medical practices, clinics, hospitals, and doctors)`)
  console.log(`- 1 Sample Client with full onboarding data (Sample Medical Clinic)`)
  console.log(`- ${tasks.length} Tasks`)
  console.log(`- 7 days of attendance records`)
  console.log(`- 1 Team chat thread`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

