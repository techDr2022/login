export const dynamic = 'force-dynamic'
export const revalidate = 60 // Revalidate every 60 seconds for attendance data

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, AttendanceMode, AttendanceStatus } from '@prisma/client'
import { parseDateLocal } from '@/lib/utils'

// Public holiday configuration (dates in YYYY-MM-DD format).
// Add or update these dates based on your company's holiday calendar.
// Current list is for the 2025 calendar year.
const PUBLIC_HOLIDAYS: string[] = [
  '2025-01-14', // Sankranthi Festival
  '2025-01-26', // Republic Day
  '2025-03-04', // Holi Festival
  '2025-03-26', // Ram Navami
  '2025-03-30', // Ugadhi
  '2025-03-31', // Ramadan
  '2025-06-07', // Bakrid
  '2025-08-09', // Ganesh Chaturthi
  '2025-08-15', // Independence Day
  '2025-10-20', // Dussehra
  '2025-11-08', // Diwali (Deepavali)
  '2025-12-25', // Christmas Day
]

function isPublicHoliday(date: Date): boolean {
  const isoDate = date.toISOString().split('T')[0]
  return PUBLIC_HOLIDAYS.includes(isoDate)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const userId = searchParams.get('userId') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        try {
          const start = parseDateLocal(startDate)
          if (isNaN(start.getTime())) {
            return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
          }
          where.date.gte = start
        } catch (error) {
          return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 })
        }
      }
      if (endDate) {
        try {
          const end = parseDateLocal(endDate)
          if (isNaN(end.getTime())) {
            return NextResponse.json({ error: 'Invalid end date' }, { status: 400 })
          }
          // Set to end of day (23:59:59.999)
          end.setHours(23, 59, 59, 999)
          where.date.lte = end
        } catch (error) {
          return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 })
        }
      }
    }

    const [attendances, total] = await Promise.all([
      prisma.attendances.findMany({
        where,
        select: {
          id: true,
          userId: true,
          loginTime: true,
          logoutTime: true,
          lunchStart: true,
          lunchEnd: true,
          totalHours: true,
          date: true,
          status: true,
          mode: true,
          earlySignInMinutes: true,
          lateSignInMinutes: true,
          earlyLogoutMinutes: true,
          lateLogoutMinutes: true,
          lastActivityTime: true,
          wfhActivityPings: true,
          remark: true,
          editedBy: true,
          editedAt: true,
          ipAddress: true,
          deviceInfo: true,
          location: true,
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      prisma.attendances.count({ where }),
    ])

    // For super admin, also include absent employees and auto-generate Present records for super admins
    // Only if date range is provided and not too large (to avoid performance issues)
    if (session.user.role === UserRole.SUPER_ADMIN && startDate && endDate) {
      try {
        const start = parseDateLocal(startDate)
        if (isNaN(start.getTime())) {
          throw new Error('Invalid start date')
        }
        
        const end = parseDateLocal(endDate)
        if (isNaN(end.getTime())) {
          throw new Error('Invalid end date')
        }
        // Set to end of day (23:59:59.999)
        end.setHours(23, 59, 59, 999)

        // Limit date range to 3 months to avoid performance issues
        const maxDays = 90
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysDiff > maxDays) {
          // Skip absent record generation for large date ranges
        } else {
          const attendanceMap = new Map(
            attendances.map((a) => [`${a.userId}-${a.date.toISOString().split('T')[0]}`, a])
          )

          // Get all existing attendances for the date range in one query
          const existingAttendances = await prisma.attendances.findMany({
            where: {
              userId: userId ? userId : undefined,
              date: {
                gte: start,
                lte: end,
              },
            },
            select: {
              userId: true,
              date: true,
            },
          })

          const existingMap = new Set(
            existingAttendances.map((a) => `${a.userId}-${a.date.toISOString().split('T')[0]}`)
          )

          // 1. Auto-generate Present records for super admins (they are always present)
          const superAdmins = await prisma.user.findMany({
            where: {
              role: UserRole.SUPER_ADMIN,
              isActive: true,
              ...(userId && { id: userId }),
            },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })

          for (const superAdmin of superAdmins) {
            const currentDate = new Date(start)
            while (currentDate <= end) {
              const isoDate = currentDate.toISOString().split('T')[0]
              const dateKey = `${superAdmin.id}-${isoDate}`
              
              if (!existingMap.has(dateKey) && !attendanceMap.has(dateKey)) {
                const dateOnly = new Date(currentDate)
                dateOnly.setHours(0, 0, 0, 0)

                // Super admins are always present (even on public holidays)
                attendances.push({
                  id: `present-${superAdmin.id}-${isoDate}`,
                  userId: superAdmin.id,
                  loginTime: null,
                  logoutTime: null,
                  totalHours: null,
                  date: dateOnly,
                  status: AttendanceStatus.Present,
                  mode: AttendanceMode.OFFICE,
                  User: superAdmin,
                  createdAt: dateOnly,
                } as any)
              }

              currentDate.setDate(currentDate.getDate() + 1)
            }
          }

          // 2. Generate absent records for employees (not super admins)
          const allEmployees = await prisma.user.findMany({
            where: {
              role: UserRole.EMPLOYEE,
              isActive: true,
              ...(userId && { id: userId }),
            },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })

          for (const employee of allEmployees) {
            const currentDate = new Date(start)
            while (currentDate <= end) {
              const isoDate = currentDate.toISOString().split('T')[0]
              const dateKey = `${employee.id}-${isoDate}`
              
              if (!existingMap.has(dateKey) && !attendanceMap.has(dateKey)) {
                const dateOnly = new Date(currentDate)
                dateOnly.setHours(0, 0, 0, 0)

                // Skip creating Absent records on public holidays
                if (!isPublicHoliday(dateOnly)) {
                  attendances.push({
                    id: `absent-${employee.id}-${isoDate}`,
                    userId: employee.id,
                    loginTime: null,
                    logoutTime: null,
                    totalHours: null,
                    date: dateOnly,
                    status: AttendanceStatus.Absent,
                    mode: AttendanceMode.OFFICE,
                    User: employee,
                    createdAt: dateOnly,
                  } as any)
                }
              }

              currentDate.setDate(currentDate.getDate() + 1)
            }
          }
        }
      } catch (error) {
        console.error('Error generating absent records:', error)
        // Continue without absent records if there's an error
      }
    }

    // Calculate summary statistics
    const summaryWhere: any = { ...where }
    if (startDate || endDate) {
      summaryWhere.date = {}
      if (startDate) {
        summaryWhere.date.gte = parseDateLocal(startDate)
      }
      if (endDate) {
        const end = parseDateLocal(endDate)
        end.setHours(23, 59, 59, 999)
        summaryWhere.date.lte = end
      }
    }

    // Office Lates: COUNT(attendance WHERE mode = OFFICE AND status = Late)
    const officeLates = await prisma.attendances.count({
      where: {
        ...summaryWhere,
        mode: AttendanceMode.OFFICE,
        status: AttendanceStatus.Late,
      },
    })

    // WFH Days: COUNT(attendance WHERE mode = WFH AND status = Present)
    const wfhDays = await prisma.attendances.count({
      where: {
        ...summaryWhere,
        mode: AttendanceMode.WFH,
        status: AttendanceStatus.Present,
      },
    })

    return NextResponse.json({
      attendances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        officeLates,
        wfhDays,
      },
    })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

