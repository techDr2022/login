import { prisma } from './prisma'
import { AttendanceStatus, AttendanceMode } from '@prisma/client'

export async function getSuperAdminDashboardData() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Logged in today
  const loggedInToday = await prisma.attendances.count({
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
      loginTime: {
        not: null,
      },
    },
  })

  // Tasks completed today
  const tasksCompletedToday = await prisma.task.count({
    where: {
      status: 'Approved',
      createdAt: {
        gte: today,
      },
    },
  })

  // Late logins today (only for OFFICE mode)
  const lateLogins = await prisma.attendances.count({
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
      status: AttendanceStatus.Late,
      mode: AttendanceMode.OFFICE,
    },
  })

  // Pending approvals
  const pendingApprovals = await prisma.task.count({
    where: {
      status: 'Review',
    },
  })

  // Total clients
  const totalClients = await prisma.client.count()

  // Recent tasks assigned by admin
  const recentTasks = await prisma.task.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      User_Task_assignedToIdToUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  // Client workload
  const clientWorkload = await prisma.client.findMany({
    include: {
      _count: {
        select: {
          Task: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  })

  // Team attendance overview
  const teamAttendance = await prisma.attendances.groupBy({
    by: ['status'],
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
    _count: {
      status: true,
    },
  })

  return {
    loggedInToday,
    tasksCompletedToday,
    lateLogins,
    pendingApprovals,
    totalClients,
    recentTasks,
    clientWorkload,
    teamAttendance,
  }
}
