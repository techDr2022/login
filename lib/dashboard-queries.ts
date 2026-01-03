import { prisma } from './prisma'
import { AttendanceStatus, AttendanceMode } from '@prisma/client'

export async function getSuperAdminDashboardData(userId?: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Get today's date range for due date filtering
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // Execute all independent queries in parallel for better performance
  const [
    loggedInToday,
    tasksCompletedToday,
    lateLogins,
    pendingApprovals,
    totalClients,
    recentTasks,
    todaysTasks,
    clientWorkload,
    teamAttendance,
    assignedByMeTasks,
  ] = await Promise.all([
    // Logged in today
    prisma.attendances.count({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
        loginTime: {
          not: null,
        },
      },
    }),

    // Tasks completed today
    prisma.task.count({
      where: {
        status: 'Approved',
        createdAt: {
          gte: today,
        },
      },
    }),

    // Late logins today (only for OFFICE mode)
    prisma.attendances.count({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
        status: AttendanceStatus.Late,
        mode: AttendanceMode.OFFICE,
      },
    }),

    // Pending approvals
    prisma.task.count({
      where: {
        status: 'Review',
      },
    }),

    // Total clients
    prisma.client.count(),

    // Recent tasks assigned by admin
    prisma.task.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        dueDate: true,
        priority: true,
        User_Task_assignedToIdToUser: {
          select: {
            id: true,
            name: true,
          },
        },
        Client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    // Today's tasks (tasks due today)
    prisma.task.findMany({
      where: {
        dueDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      take: 10,
      orderBy: { dueDate: 'asc' },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        User_Task_assignedToIdToUser: {
          select: {
            id: true,
            name: true,
          },
        },
        Client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),

    // Client workload
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
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
    }),

    // Team attendance overview
    prisma.attendances.groupBy({
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
    }),

    // Tasks assigned by me (if userId provided)
    userId
      ? prisma.task.findMany({
          where: {
            assignedById: userId,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            User_Task_assignedToIdToUser: {
              select: {
                id: true,
                name: true,
              },
            },
            Client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ])

  return {
    loggedInToday,
    tasksCompletedToday,
    lateLogins,
    pendingApprovals,
    totalClients,
    recentTasks,
    todaysTasks,
    clientWorkload,
    teamAttendance,
    assignedByMeTasks,
  }
}
