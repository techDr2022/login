export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole, AttendanceMode } from '@prisma/client'
import { ATTENDANCE_CONFIG } from '@/lib/attendance-config'

/**
 * GET /api/attendance/wfh-activity
 * Get WFH activity metrics for a user or all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || session.user.id
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Only admins can view other users' activity
    if (userId !== session.user.id && session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get today's attendance
    const todayAttendance = await prisma.attendances.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      select: {
        id: true,
        mode: true,
        loginTime: true,
        logoutTime: true,
        lastActivityTime: true,
        wfhActivityPings: true,
        totalHours: true,
      },
    })

    // If date range provided, get historical data
    let historicalData: any[] = []
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)

      historicalData = await prisma.attendances.findMany({
        where: {
          userId,
          date: {
            gte: start,
            lte: end,
          },
          mode: AttendanceMode.WFH,
        },
        select: {
          id: true,
          date: true,
          loginTime: true,
          logoutTime: true,
          lastActivityTime: true,
          wfhActivityPings: true,
          totalHours: true,
        },
        orderBy: { date: 'desc' },
      })
    }

    // Get task activity for today
    const todayStart = new Date(today)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const taskActivity = await prisma.activity_logs.findMany({
      where: {
        userId,
        entityType: 'Task',
        timestamp: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: {
        action: true,
        timestamp: true,
        entityId: true,
      },
    })

    // Get tasks updated/completed today
    const tasksUpdated = await prisma.task.findMany({
      where: {
        assignedToId: userId,
        updatedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        timeSpent: true,
        updatedAt: true,
      },
    })

    // Calculate productivity metrics
    const totalTaskTime = tasksUpdated.reduce((sum, task) => sum + (task.timeSpent || 0), 0)
    const tasksCompleted = tasksUpdated.filter(t => t.status === 'Approved').length
    const tasksInProgress = tasksUpdated.filter(t => t.status === 'InProgress').length

    // Calculate activity score
    let activityScore = 0
    if (todayAttendance && todayAttendance.mode === AttendanceMode.WFH && todayAttendance.loginTime) {
      const loginTime = new Date(todayAttendance.loginTime)
      const now = new Date()
      const hoursSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60)
      
      // Expected pings based on hours worked
      const expectedPings = Math.floor(hoursSinceLogin / (ATTENDANCE_CONFIG.WFH_ACTIVITY_PING_INTERVAL_MINUTES / 60))
      const actualPings = todayAttendance.wfhActivityPings || 0
      
      // Activity score: percentage of expected pings received
      if (expectedPings > 0) {
        activityScore = Math.min(100, Math.round((actualPings / expectedPings) * 100))
      } else {
        activityScore = 100 // Just logged in
      }
    }

    // Check for inactivity warning
    let inactivityWarning: { minutes: number; message: string } | null = null
    if (todayAttendance && todayAttendance.mode === AttendanceMode.WFH && todayAttendance.lastActivityTime && !todayAttendance.logoutTime) {
      const lastActivity = new Date(todayAttendance.lastActivityTime)
      const now = new Date()
      const minutesSinceLastActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60)
      
      if (minutesSinceLastActivity >= ATTENDANCE_CONFIG.WFH_INACTIVITY_THRESHOLD_MINUTES) {
        inactivityWarning = {
          minutes: Math.round(minutesSinceLastActivity),
          message: `No activity detected for ${Math.round(minutesSinceLastActivity)} minutes`,
        }
      }
    }

    return NextResponse.json({
      today: {
        attendance: todayAttendance ? {
          mode: todayAttendance.mode,
          loginTime: todayAttendance.loginTime?.toISOString() ?? null,
          logoutTime: todayAttendance.logoutTime?.toISOString() ?? null,
          lastActivityTime: todayAttendance.lastActivityTime?.toISOString() ?? null,
          wfhActivityPings: todayAttendance.wfhActivityPings,
          totalHours: todayAttendance.totalHours,
        } : null,
        metrics: {
          activityScore,
          totalTaskTime,
          tasksCompleted,
          tasksInProgress,
          taskUpdates: taskActivity.length,
          inactivityWarning,
        },
      },
      historical: historicalData.map(record => ({
        ...record,
        date: record.date.toISOString().split('T')[0],
        loginTime: record.loginTime?.toISOString() ?? null,
        logoutTime: record.logoutTime?.toISOString() ?? null,
        lastActivityTime: record.lastActivityTime?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    console.error('Error fetching WFH activity:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

