import { prisma } from './prisma'
import { AttendanceStatus, AttendanceMode } from '@prisma/client'

// Helper function to transform task data to use friendlier field names
function transformTask(task: any) {
  return {
    ...task,
    client: task.Client || null,
    assignedBy: task.User_Task_assignedByIdToUser || null,
    assignedTo: task.User_Task_assignedToIdToUser || null,
  }
}

function transformTasks(tasks: any[]) {
  return tasks.map(transformTask)
}

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

  const teamPresent = await prisma.attendances.count({
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
      User_Task_assignedToIdToUser: {
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
  const teamAttendance = await prisma.attendances.findMany({
    where: {
      date: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    include: {
      User: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { date: 'desc' },
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
      User_Task_assignedToIdToUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
  })

  // Tasks assigned today by this manager
  const tasksAssignedToday = await prisma.task.findMany({
    where: {
      assignedById: userId,
      createdAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    include: {
      User_Task_assignedToIdToUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Recent tasks assigned by this manager (last 7 days)
  const sevenDaysAgo = new Date(todayStart)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  const recentAssignedTasks = await prisma.task.findMany({
    where: {
      assignedById: userId,
      createdAt: {
        gte: sevenDaysAgo,
      },
    },
    include: {
      User_Task_assignedToIdToUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Active tasks (InProgress) assigned by this manager
  const activeTasks = await prisma.task.findMany({
    where: {
      assignedById: userId,
      status: 'InProgress',
    },
    include: {
      User_Task_assignedToIdToUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return {
    totalAssignedTasks,
    pendingReviews,
    missedDeadlines,
    teamPresent,
    pendingApprovalsList,
    teamAttendance,
    missedDeadlinesList,
    tasksAssignedToday,
    recentAssignedTasks,
    activeTasks,
  }
}

export async function getEmployeeDashboardData(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  // Start of week (Monday)
  const startOfWeek = new Date(today)
  const dayOfWeek = today.getDay()
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Adjust to Monday
  startOfWeek.setDate(diff)
  startOfWeek.setHours(0, 0, 0, 0)

  // 24 hours from now
  const next24Hours = new Date()
  next24Hours.setHours(next24Hours.getHours() + 24)

  // 1. Summary Cards
  const totalTasks = await prisma.task.count({
    where: {
      assignedToId: userId,
    },
  })

  const pendingInProgress = await prisma.task.count({
    where: {
      assignedToId: userId,
      status: {
        in: ['Pending', 'InProgress'],
      },
    },
  })

  const inReviewRevisions = await prisma.task.count({
    where: {
      assignedToId: userId,
      status: 'Review',
    },
  })

  const completedThisWeek = await prisma.task.count({
    where: {
      assignedToId: userId,
      status: 'Approved',
      createdAt: {
        gte: startOfWeek,
      },
    },
  })

  // 2. Today's Priority Tasks (max 7, ordered by priority and due date)
  const todayPriorityTasksRaw = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      status: {
        in: ['Pending', 'InProgress', 'Review'],
      },
      dueDate: {
        lte: tomorrow,
      },
    },
    include: {
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
      User_Task_assignedByIdToUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { priority: 'desc' }, // Urgent first
      { dueDate: 'asc' },
    ],
    take: 7,
  })

  // Transform to use friendlier field names
  const todayPriorityTasks = transformTasks(todayPriorityTasksRaw)

  // 3. Overdue Tasks
  const overdueTasksRaw = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      dueDate: {
        lt: today,
      },
      status: {
        not: 'Approved',
      },
    },
    include: {
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })
  const overdueTasks = transformTasks(overdueTasksRaw)

  // 4. Risk Tasks (due in next 24 hours)
  const riskTasksRaw = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      dueDate: {
        gte: today,
        lte: next24Hours,
      },
      status: {
        not: 'Approved',
      },
    },
    include: {
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })
  const riskTasks = transformTasks(riskTasksRaw)

  // 5. Kanban Board Tasks (grouped by status)
  const allTasksRaw = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      status: {
        not: 'Approved', // Exclude completed from kanban
      },
    },
    include: {
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
      User_Task_assignedByIdToUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { dueDate: 'asc' },
    ],
  })

  const allTasks = transformTasks(allTasksRaw)

  // Group tasks by status for Kanban
  const completedTasksRaw = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      status: 'Approved',
    },
    include: {
      Client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20, // Recent completed tasks
  })
  const completedTasks = transformTasks(completedTasksRaw)

  const kanbanTasks = {
    todo: allTasks.filter(t => t.status === 'Pending'),
    inProgress: allTasks.filter(t => t.status === 'InProgress'),
    review: allTasks.filter(t => t.status === 'Review'),
    revision: allTasks.filter(t => t.status === 'Rejected'), // Rejected = Revision needed
    completed: completedTasks,
  }

  // 6. Activity Feed (recent activity logs related to user's tasks)
  // Get all task IDs (including completed) for activity feed
  const allTaskIds = await prisma.task.findMany({
    where: {
      assignedToId: userId,
    },
    select: {
      id: true,
    },
  })

  const recentActivities = allTaskIds.length > 0 ? await prisma.activity_logs.findMany({
    where: {
      entityType: 'Task',
      entityId: {
        in: allTaskIds.map(t => t.id),
      },
    },
    include: {
      User: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: 20,
  }) : []

  // 7. Performance Metrics
  // Completed this week (already have)
  // Average completion time - using activity logs to find when tasks were approved
  const performanceCompletedTasks = await prisma.task.findMany({
    where: {
      assignedToId: userId,
      status: 'Approved',
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    select: {
      id: true,
      createdAt: true,
      dueDate: true,
    },
  })

  let avgCompletionTime = 0
  let onTimePercentage = 0

  if (performanceCompletedTasks.length > 0) {
    // Get approval timestamps from activity logs
    const taskIds = performanceCompletedTasks.map(t => t.id)
    const approvalActivities = taskIds.length > 0 ? await prisma.activity_logs.findMany({
      where: {
        entityType: 'Task',
        entityId: { in: taskIds },
        action: 'UPDATE',
      },
      select: {
        entityId: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'desc' },
    }) : []

    // Group by task ID and get the latest UPDATE (which should be when it was approved)
    const taskApprovalTimes = new Map<string, Date>()
    approvalActivities.forEach(activity => {
      if (!taskApprovalTimes.has(activity.entityId)) {
        taskApprovalTimes.set(activity.entityId, activity.timestamp)
      }
    })

    // Calculate average completion time in hours
    const completionTimes = performanceCompletedTasks
      .map(t => {
        const approvalTime = taskApprovalTimes.get(t.id) || t.createdAt
        const diff = approvalTime.getTime() - t.createdAt.getTime()
        return diff / (1000 * 60 * 60) // Convert to hours
      })
      .filter(time => time >= 0) // Filter out negative times (shouldn't happen)
    
    if (completionTimes.length > 0) {
      avgCompletionTime = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
    }

    // Calculate on-time percentage
    const onTimeTasks = performanceCompletedTasks.filter(t => {
      if (!t.dueDate) return false
      const approvalTime = taskApprovalTimes.get(t.id) || t.createdAt
      return approvalTime <= t.dueDate
    }).length

    onTimePercentage = (onTimeTasks / performanceCompletedTasks.length) * 100
  }

  // Today attendance status
  const todayAttendance = await prisma.attendances.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  })

  return {
    // Summary cards
    totalTasks,
    pendingInProgress,
    inReviewRevisions,
    completedThisWeek,
    
    // Priority sections
    todayPriorityTasks,
    overdueTasks,
    riskTasks,
    
    // Kanban
    kanbanTasks,
    
    // Activity feed
    recentActivities,
    
    // Performance
    performance: {
      completedThisWeek,
      avgCompletionTime: Math.round(avgCompletionTime * 10) / 10, // Round to 1 decimal
      onTimePercentage: Math.round(onTimePercentage * 10) / 10,
    },
    
    // Legacy (for backward compatibility)
    todayAttendance,
  }
}

