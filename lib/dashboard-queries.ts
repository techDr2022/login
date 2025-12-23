import { prisma } from './prisma'
import { AttendanceStatus, AttendanceMode } from '@prisma/client'

export async function getSuperAdminDashboardData() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Logged in today
  const loggedInToday = await prisma.attendance.count({
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
  const lateLogins = await prisma.attendance.count({
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
      assignedTo: {
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
          tasks: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  })

  // Team attendance overview
  const teamAttendance = await prisma.attendance.groupBy({
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

export async function getManagerDashboardData(userId: string) {
  // Total assigned tasks
  const totalAssignedTasks = await prisma.task.count({
    where: {
      assignedById: userId,
    },
  })

  // Pending reviews
  const pendingReviews = await prisma.task.count({
    where: {
      status: 'Review',
      assignedById: userId,
    },
  })

  // Missed deadlines
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const missedDeadlines = await prisma.task.count({
    where: {
      assignedById: userId,
      dueDate: {
        lt: today,
      },
      status: {
        not: 'Approved',
      },
    },
  })

  // Team present today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const teamPresent = await prisma.attendance.count({
    where: {
      date: {
        gte: todayStart,
        lt: todayEnd,
      },
      status: AttendanceStatus.Present,
    },
  })

  // Pending approvals list
  const pendingApprovalsList = await prisma.task.findMany({
    where: {
      status: 'Review',
      assignedById: userId,
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Team attendance
  const teamAttendance = await prisma.attendance.findMany({
    where: {
      date: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { loginTime: 'desc' },
  })

  // Missed deadlines alerts
  const missedDeadlinesList = await prisma.task.findMany({
    where: {
      assignedById: userId,
      dueDate: {
        lt: today,
      },
      status: {
        not: 'Approved',
      },
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
  })

  return {
    totalAssignedTasks,
    pendingReviews,
    missedDeadlines,
    teamPresent,
    pendingApprovalsList,
    teamAttendance,
    missedDeadlinesList,
  }
}

export async function getEmployeeDashboardData(userId: string) {
  // My tasks stats
  const myTasksTotal = await prisma.task.count({
    where: {
      assignedToId: userId,
    },
  })

  const myTasksCompleted = await prisma.task.count({
    where: {
      assignedToId: userId,
      status: 'Approved',
    },
  })

  const myTasksPending = await prisma.task.count({
    where: {
      assignedToId: userId,
      status: 'Pending',
    },
  })

  const myTasksInProgress = await prisma.task.count({
    where: {
      assignedToId: userId,
      status: 'InProgress',
    },
  })

  // My active tasks
  const myActiveTasks = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      status: {
        in: ['Pending', 'InProgress', 'Review'],
      },
    },
    include: {
      assignedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
  })

  // Today attendance status
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayAttendance = await prisma.attendance.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  })

  return {
    myTasksTotal,
    myTasksCompleted,
    myTasksPending,
    myTasksInProgress,
    myActiveTasks,
    todayAttendance,
  }
}

