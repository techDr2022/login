'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  CheckSquare2, 
  Clock, 
  Circle, 
  ArrowRight, 
  Calendar, 
  AlertCircle, 
  TrendingUp,
  Plus,
  Link as LinkIcon,
  MessageSquare,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
  Target,
  LogIn,
  LogOut,
  Info
} from 'lucide-react'
import Link from 'next/link'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getEmployeeDashboardData } from '@/lib/dashboard-queries'

// Helper function to infer task type from title/description
function getTaskType(task: { title: string; description?: string | null }): string {
  const text = `${task.title} ${task.description || ''}`.toLowerCase()
  
  if (text.includes('design') || text.includes('canva') || text.includes('graphic') || text.includes('visual')) {
    return 'Design'
  }
  if (text.includes('seo') || text.includes('search') || text.includes('optimization')) {
    return 'SEO'
  }
  if (text.includes('ad') || text.includes('campaign') || text.includes('facebook') || text.includes('google ads')) {
    return 'Ads'
  }
  if (text.includes('content') || text.includes('post') || text.includes('copy') || text.includes('write')) {
    return 'Content'
  }
  return 'Other'
}

// Helper to get priority color
function getPriorityColor(priority: string) {
  switch (priority) {
    case 'Urgent':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'High':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'Medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'Low':
      return 'bg-green-100 text-green-800 border-green-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Helper to format time remaining
function getTimeRemaining(dueDate: Date | string | null): string {
  if (!dueDate) return 'No due date'
  
  const due = new Date(dueDate)
  const now = new Date()
  const diff = due.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  
  if (diff < 0) return 'Overdue'
  if (hours < 1) return 'Due soon'
  if (hours < 24) return `Due in ${hours}h`
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days}d`
}

interface EmployeeDashboardClientProps {
  data: Awaited<ReturnType<typeof getEmployeeDashboardData>>
  userName: string
}

export function EmployeeDashboardClient({ data, userName }: EmployeeDashboardClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [showOverdue, setShowOverdue] = useState(data.overdueTasks.length > 0)
  const [idleWarning, setIdleWarning] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const lastActivityRef = useRef<number>(Date.now())
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const warningShownRef = useRef(false)

  // Check if employee has clocked in today
  const hasClockedIn = data.todayAttendance?.loginTime !== null
  const hasClockedOut = data.todayAttendance?.logoutTime !== null
  const isClockedIn = hasClockedIn && !hasClockedOut

  // Idle detection: Warn after 30 minutes of inactivity, auto-logout after 60 minutes
  const IDLE_WARNING_TIME = 30 * 60 * 1000 // 30 minutes
  const IDLE_LOGOUT_TIME = 60 * 60 * 1000 // 60 minutes

  // Track user activity
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
      if (idleWarning) {
        setIdleWarning(false)
        warningShownRef.current = false
      }
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      window.addEventListener(event, updateActivity, true)
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity, true)
      })
    }
  }, [idleWarning])

  // Check for idle time (only if clocked in)
  useEffect(() => {
    if (!isClockedIn) return

    const checkIdle = () => {
      const now = Date.now()
      const idleTime = now - lastActivityRef.current

      if (idleTime >= IDLE_LOGOUT_TIME && !warningShownRef.current) {
        // Auto-logout after 60 minutes of inactivity
        alert('You have been inactive for 60 minutes. Please clock out if you are done for the day.')
        warningShownRef.current = true
      } else if (idleTime >= IDLE_WARNING_TIME && !idleWarning) {
        // Warn after 30 minutes
        setIdleWarning(true)
      }
    }

    idleCheckIntervalRef.current = setInterval(checkIdle, 60000) // Check every minute

    return () => {
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current)
      }
    }
  }, [isClockedIn, idleWarning])

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      setIsTabVisible(isVisible)
      
      if (isVisible && isClockedIn) {
        // Tab became visible again - update last activity
        lastActivityRef.current = Date.now()
        if (idleWarning) {
          setIdleWarning(false)
          warningShownRef.current = false
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isClockedIn, idleWarning])

  // Warn before closing tab if clocked in
  useEffect(() => {
    if (!isClockedIn) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'You are currently clocked in. Make sure to clock out before leaving!'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isClockedIn])

  // Get unique clients for filter
  const allClients = useMemo(() => {
    const clients = new Set<string>()
    data.kanbanTasks.todo.forEach(t => t.client?.name && clients.add(t.client.name))
    data.kanbanTasks.inProgress.forEach(t => t.client?.name && clients.add(t.client.name))
    data.kanbanTasks.review.forEach(t => t.client?.name && clients.add(t.client.name))
    data.kanbanTasks.revision.forEach(t => t.client?.name && clients.add(t.client.name))
    return Array.from(clients).sort()
  }, [data.kanbanTasks])

  // Filter tasks for Kanban
  const filteredKanbanTasks = useMemo(() => {
    let tasks = {
      todo: [...data.kanbanTasks.todo],
      inProgress: [...data.kanbanTasks.inProgress],
      review: [...data.kanbanTasks.review],
      revision: [...data.kanbanTasks.revision],
      completed: [...data.kanbanTasks.completed],
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const filterTasks = (taskList: typeof tasks.todo) => 
        taskList.filter(t => 
          t.title.toLowerCase().includes(query) ||
          t.client?.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
        )
      
      tasks.todo = filterTasks(tasks.todo)
      tasks.inProgress = filterTasks(tasks.inProgress)
      tasks.review = filterTasks(tasks.review)
      tasks.revision = filterTasks(tasks.revision)
      tasks.completed = filterTasks(tasks.completed)
    }

    // Apply client filter
    if (clientFilter !== 'all') {
      const filterTasks = (taskList: typeof tasks.todo) => 
        taskList.filter(t => t.client?.name === clientFilter)
      
      tasks.todo = filterTasks(tasks.todo)
      tasks.inProgress = filterTasks(tasks.inProgress)
      tasks.review = filterTasks(tasks.review)
      tasks.revision = filterTasks(tasks.revision)
      tasks.completed = filterTasks(tasks.completed)
    }

    return tasks
  }, [searchQuery, clientFilter, data.kanbanTasks])

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h1 className="text-2xl font-semibold">{userName}</h1>
        <p className="text-sm text-muted-foreground mt-1">What do you need to do today?</p>
      </div>

      {/* Attendance Reminder Banner */}
      {!hasClockedIn && (
        <Alert className="border-orange-200 bg-orange-50">
          <LogIn className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800">Clock In Required</AlertTitle>
          <AlertDescription className="text-orange-700">
            <div className="flex items-center justify-between mt-2">
              <span>You haven&apos;t clocked in today. Please clock in to mark your attendance.</span>
              <Link href="/attendance">
                <Button size="sm" className="ml-4 bg-orange-600 hover:bg-orange-700">
                  <LogIn className="w-4 h-4 mr-2" />
                  Clock In Now
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Clocked In Status Banner */}
      {isClockedIn && (
        <Alert className="border-green-200 bg-green-50">
          <Clock className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">You are Clocked In</AlertTitle>
          <AlertDescription className="text-green-700">
            <div className="flex items-center justify-between mt-2">
              <div>
                <p>Login Time: {data.todayAttendance?.loginTime ? new Date(data.todayAttendance.loginTime).toLocaleTimeString() : 'N/A'}</p>
                <p className="text-xs mt-1">Keep this tab open while working. Don&apos;t close or minimize for extended periods.</p>
              </div>
              <Link href="/attendance">
                <Button size="sm" variant="outline" className="ml-4 border-green-600 text-green-700 hover:bg-green-100">
                  <LogOut className="w-4 h-4 mr-2" />
                  Clock Out
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Idle Warning */}
      {idleWarning && isClockedIn && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Inactivity Detected</AlertTitle>
          <AlertDescription className="text-yellow-700">
            <div className="flex items-center justify-between mt-2">
              <span>You haven&apos;t been active for 30 minutes. Are you still working? If not, please clock out.</span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                  onClick={() => {
                    lastActivityRef.current = Date.now()
                    setIdleWarning(false)
                    warningShownRef.current = false
                  }}
                >
                  I&apos;m Still Working
                </Button>
                <Link href="/attendance">
                  <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                    <LogOut className="w-4 h-4 mr-2" />
                    Clock Out
                  </Button>
                </Link>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tab Minimized Warning */}
      {!isTabVisible && isClockedIn && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Tab Minimized</AlertTitle>
          <AlertDescription className="text-blue-700">
            Your browser tab is minimized or in the background. Make sure to keep the tab active while working.
          </AlertDescription>
        </Alert>
      )}

      {/* User Guidance */}
      {!hasClockedIn && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Getting Started</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2 text-sm">
              <p><strong>After logging in, you should:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to the <Link href="/attendance" className="text-primary underline">Attendance</Link> page and click &quot;Clock In&quot;</li>
                <li>Keep the browser tab open while you work (you can minimize it, but don&apos;t close it)</li>
                <li>When you&apos;re done for the day, click &quot;Clock Out&quot; on the Attendance page</li>
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>Note:</strong> If you just log in and don&apos;t clock in, you won&apos;t be marked as present for the day.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 1. Top Summary Section - 4 Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks Assigned</CardTitle>
            <CheckSquare2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">All assigned tasks</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending / In Progress</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{data.pendingInProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Review / Revisions</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.inReviewRevisions}</div>
            <p className="text-xs text-muted-foreground mt-1">Under review</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.completedThisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks finished</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Today's Priority Tasks */}
      {data.todayPriorityTasks.length > 0 && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s Priority Tasks</CardTitle>
            <CardDescription>Your most important tasks for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.todayPriorityTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-muted-foreground">
                        {task.client?.name || 'No Client'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getTaskType(task)}
                      </Badge>
                      <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm truncate">{task.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {task.dueDate ? (
                        <span>{getTimeRemaining(task.dueDate)}</span>
                      ) : (
                        <span>No due date</span>
                      )}
                    </div>
                  </div>
                  <Link href={`/tasks/${task.id}`}>
                    <Button size="sm" className="ml-4">
                      Open Task
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Overdue & Risk Section */}
      {(data.overdueTasks.length > 0 || data.riskTasks.length > 0) && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Attention Required
                </CardTitle>
                <CardDescription>Tasks that need immediate attention</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOverdue(!showOverdue)}
              >
                {showOverdue ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>
          {showOverdue && (
            <CardContent className="space-y-4">
              {data.overdueTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Overdue Tasks ({data.overdueTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {data.overdueTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="block p-3 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.client?.name} • Due {new Date(task.dueDate!).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className="bg-red-600 text-white">Overdue</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data.riskTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Due in Next 24 Hours ({data.riskTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {data.riskTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="block p-3 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.client?.name} • {getTimeRemaining(task.dueDate!)}
                            </p>
                          </div>
                          <Badge className="bg-orange-600 text-white">Due Soon</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* 4. Task Board - Kanban View */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-lg">Task Board</CardTitle>
              <CardDescription>Drag and organize your tasks</CardDescription>
            </div>
          </div>
          
          {/* Filters & Search */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {allClients.map((client) => (
                  <SelectItem key={client} value={client}>
                    {client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto">
            {/* To Do Column */}
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-3">
                <Circle className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold text-sm">To Do</h3>
                <Badge variant="outline" className="ml-auto">
                  {filteredKanbanTasks.todo.length}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {filteredKanbanTasks.todo.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {filteredKanbanTasks.todo.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No tasks
                  </div>
                )}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-sm">In Progress</h3>
                <Badge variant="outline" className="ml-auto">
                  {filteredKanbanTasks.inProgress.length}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {filteredKanbanTasks.inProgress.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {filteredKanbanTasks.inProgress.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No tasks
                  </div>
                )}
              </div>
            </div>

            {/* Review Column */}
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm">Review</h3>
                <Badge variant="outline" className="ml-auto">
                  {filteredKanbanTasks.review.length}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {filteredKanbanTasks.review.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {filteredKanbanTasks.review.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No tasks
                  </div>
                )}
              </div>
            </div>

            {/* Revision Column */}
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold text-sm">Revision</h3>
                <Badge variant="outline" className="ml-auto">
                  {filteredKanbanTasks.revision.length}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {filteredKanbanTasks.revision.map((task) => (
                  <TaskCard key={task.id} task={task} showRevisionBadge />
                ))}
                {filteredKanbanTasks.revision.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No tasks
                  </div>
                )}
              </div>
            </div>

            {/* Completed Column */}
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold text-sm">Completed</h3>
                <Badge variant="outline" className="ml-auto">
                  {filteredKanbanTasks.completed.length}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {filteredKanbanTasks.completed.map((task) => (
                  <TaskCard key={task.id} task={task} isCompleted />
                ))}
                {filteredKanbanTasks.completed.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Quick Actions */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription>Common actions to save time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/tasks?create=true">
              <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                <Plus className="h-5 w-5" />
                <span className="text-xs">Add Work Update</span>
              </Button>
            </Link>
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
              <LinkIcon className="h-5 w-5" />
              <span className="text-xs">Paste Canva / Doc Link</span>
            </Button>
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
              <RefreshCw className="h-5 w-5" />
              <span className="text-xs">Mark for Review</span>
            </Button>
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
              <MessageSquare className="h-5 w-5" />
              <span className="text-xs">Reply to Feedback</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 6. Work Update / Activity Feed */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Activity Feed</CardTitle>
                <CardDescription>Recent updates on your tasks</CardDescription>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentActivities.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex gap-3 pb-4 border-b last:border-0">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.User.name}</span>
                        {' '}
                        <span className="text-muted-foreground">{activity.action.toLowerCase()}</span>
                        {' '}
                        <span className="text-muted-foreground">task</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. Performance Snapshot */}
        <Card className="rounded-xl border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Performance Snapshot</CardTitle>
                <CardDescription>Your productivity metrics</CardDescription>
              </div>
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Tasks Completed This Week</p>
                <span className="text-2xl font-bold text-green-600">
                  {data.performance.completedThisWeek}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Avg Completion Time</p>
                <span className="text-2xl font-bold">
                  {data.performance.avgCompletionTime}h
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Average time to complete tasks</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">On-Time Percentage</p>
                <span className="text-2xl font-bold text-blue-600">
                  {data.performance.onTimePercentage}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Tasks completed on or before due date</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Task Card Component for Kanban
function TaskCard({ 
  task, 
  isCompleted = false, 
  showRevisionBadge = false 
}: { 
  task: any
  isCompleted?: boolean
  showRevisionBadge?: boolean
}) {
  return (
    <Link href={`/tasks/${task.id}`}>
      <div className={`p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer ${
        isCompleted ? 'opacity-75' : ''
      }`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm line-clamp-2 flex-1">{task.title}</h4>
          <Badge className={`text-xs shrink-0 ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </Badge>
        </div>
        {task.client && (
          <p className="text-xs text-muted-foreground mb-1 truncate">
            {task.client.name}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {getTaskType(task)}
            </Badge>
            {showRevisionBadge && (
              <Badge variant="destructive" className="text-xs">
                Revision
              </Badge>
            )}
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

