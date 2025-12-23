export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, AttendanceMode, AttendanceStatus } from '@prisma/client'

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

    // Employees can only see their own attendance
    if (session.user.role === UserRole.EMPLOYEE) {
      where.userId = session.user.id
    } else if (userId) {
      where.userId = userId
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        const start = new Date(startDate)
        if (isNaN(start.getTime())) {
          return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
        }
        start.setHours(0, 0, 0, 0)
        where.date.gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        if (isNaN(end.getTime())) {
          return NextResponse.json({ error: 'Invalid end date' }, { status: 400 })
        }
        end.setHours(23, 59, 59, 999)
        where.date.lte = end
      }
    }

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          user: {
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
      prisma.attendance.count({ where }),
    ])

    // For managers/admin, also include absent employees for the date range
    // Only if date range is provided and not too large (to avoid performance issues)
    if (session.user.role !== UserRole.EMPLOYEE && startDate && endDate) {
      try {
        const start = new Date(startDate)
        if (isNaN(start.getTime())) {
          throw new Error('Invalid start date')
        }
        start.setHours(0, 0, 0, 0)
        
        const end = new Date(endDate)
        if (isNaN(end.getTime())) {
          throw new Error('Invalid end date')
        }
        end.setHours(23, 59, 59, 999)

        // Limit date range to 3 months to avoid performance issues
        const maxDays = 90
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysDiff > maxDays) {
          // Skip absent record generation for large date ranges
        } else {
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

          const attendanceMap = new Map(
            attendances.map((a) => [`${a.userId}-${a.date.toISOString().split('T')[0]}`, a])
          )

          // Get all existing attendances for the date range in one query
          const existingAttendances = await prisma.attendance.findMany({
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

          // Add absent records for employees without attendance
          for (const employee of allEmployees) {
            const currentDate = new Date(start)
            while (currentDate <= end) {
              const dateKey = `${employee.id}-${currentDate.toISOString().split('T')[0]}`
              
              if (!existingMap.has(dateKey) && !attendanceMap.has(dateKey)) {
                const dateOnly = new Date(currentDate)
                dateOnly.setHours(0, 0, 0, 0)
                
                attendances.push({
                  id: `absent-${employee.id}-${dateOnly.toISOString().split('T')[0]}`,
                  userId: employee.id,
                  loginTime: null,
                  logoutTime: null,
                  totalHours: null,
                  date: dateOnly,
                  status: AttendanceStatus.Absent,
                  mode: AttendanceMode.OFFICE,
                  user: employee,
                  createdAt: dateOnly,
                } as any)
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
        summaryWhere.date.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        summaryWhere.date.lte = end
      }
    }

    // Office Lates: COUNT(attendance WHERE mode = OFFICE AND status = Late)
    const officeLates = await prisma.attendance.count({
      where: {
        ...summaryWhere,
        mode: AttendanceMode.OFFICE,
        status: AttendanceStatus.Late,
      },
    })

    // WFH Days: COUNT(attendance WHERE mode = WFH AND status = Present)
    const wfhDays = await prisma.attendance.count({
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

