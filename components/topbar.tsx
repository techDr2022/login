'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { Bell, Search, User, LogOut, Settings, CheckSquare2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useTaskNotifications } from '@/components/tasks/task-notifications'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tasks': 'Tasks',
  '/clients': 'Clients',
  '/attendance': 'Attendance',
  '/chat': 'Team Chat',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export function TopBar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [taskNotifications, setTaskNotifications] = useState(0)
  const [recentTasks, setRecentTasks] = useState<Array<any>>([])
  const [seenTaskIds, setSeenTaskIds] = useState<Set<string>>(new Set())
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false)

  // Set up real-time task notifications
  useTaskNotifications({
    onNewTask: (task) => {
      // Add to recent tasks list (new tasks are unseen by default)
      setRecentTasks((prev) => {
        const newTasks = [task, ...prev.filter(t => t.id !== task.id)].slice(0, 5)
        return newTasks
      })
    },
    onTaskCountUpdate: (count) => {
      setTaskNotifications(count)
    },
  })

  // Mark all current tasks as seen when dropdown opens
  const handleNotificationDropdownOpenChange = (open: boolean) => {
    setNotificationDropdownOpen(open)
    if (open) {
      // Mark all recent tasks as seen
      const allTaskIds = new Set<string>()
      recentTasks.forEach(task => allTaskIds.add(task.id))
      setSeenTaskIds(prev => new Set([...prev, ...allTaskIds]))
      
      // Also fetch and mark all pending/in-progress tasks as seen
      if (session?.user?.id) {
        Promise.all([
          fetch(`/api/tasks?assignedToId=${session.user.id}&status=Pending&limit=1000`),
          fetch(`/api/tasks?assignedToId=${session.user.id}&status=InProgress&limit=1000`),
        ]).then(([pendingRes, inProgressRes]) => {
          Promise.all([pendingRes.json(), inProgressRes.json()]).then(([pendingData, inProgressData]) => {
            const allPendingTaskIds = new Set<string>()
            pendingData.tasks?.forEach((task: any) => allPendingTaskIds.add(task.id))
            inProgressData.tasks?.forEach((task: any) => allPendingTaskIds.add(task.id))
            setSeenTaskIds(prev => new Set([...prev, ...allPendingTaskIds]))
          })
        }).catch(err => console.error('Failed to mark tasks as seen:', err))
      }
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Fetch initial task count
  useEffect(() => {
    const fetchTaskCount = async () => {
      if (!session?.user?.id) return
      
      try {
        // Count pending and in-progress tasks assigned to user
        const [pendingRes, inProgressRes] = await Promise.all([
          fetch(`/api/tasks?assignedToId=${session.user.id}&status=Pending&limit=1`),
          fetch(`/api/tasks?assignedToId=${session.user.id}&status=InProgress&limit=1`),
        ])
        
        const pendingData = await pendingRes.json()
        const inProgressData = await inProgressRes.json()
        const total = (pendingData.pagination?.total || 0) + (inProgressData.pagination?.total || 0)
        setTaskNotifications(total)
      } catch (error) {
        console.error('Failed to fetch task count:', error)
      }
    }

    fetchTaskCount()
  }, [session?.user?.id])

  if (!session) return null

  const role = session.user.role as UserRole
  const pageTitle = pageTitles[pathname] || 'TechDr'

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'default'
      default:
        return 'outline'
    }
  }

  const formatNotificationTime = (dateString: string | Date | undefined) => {
    if (!dateString) return ''
    
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return 'Just now'
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
    }
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`
    }
    
    // For older notifications, show the actual date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const searchItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard', keywords: ['dashboard', 'home'] },
    { id: 'tasks', label: 'Tasks', href: '/tasks', keywords: ['tasks', 'task'] },
    { id: 'clients', label: 'Clients', href: '/clients', keywords: ['clients', 'client'] },
    { id: 'attendance', label: 'Attendance', href: '/attendance', keywords: ['attendance', 'time'] },
    { id: 'chat', label: 'Team Chat', href: '/chat', keywords: ['chat', 'message'] },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between px-4 md:px-6">
          {/* Page Title */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">{pageTitle}</h1>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Global Search */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-5 w-5" />
              <kbd className="pointer-events-none absolute right-1 top-1 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            {/* Notifications */}
            <DropdownMenu open={notificationDropdownOpen} onOpenChange={handleNotificationDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {(() => {
                    // Count only unseen recent tasks
                    const unseenRecentTasks = recentTasks.filter(task => !seenTaskIds.has(task.id))
                    const unseenCount = unseenRecentTasks.length
                    // Show badge if there are unseen recent tasks
                    // Once dropdown is opened, all tasks are marked as seen, so badge disappears
                    return unseenCount > 0 ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                        {unseenCount > 9 ? '9+' : unseenCount}
                      </span>
                    ) : null
                  })()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  {taskNotifications > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {taskNotifications} task{taskNotifications !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {taskNotifications === 0 && recentTasks.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No new notifications
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    {recentTasks.length > 0 && (
                      <>
                        <div className="p-2">
                          <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Recent Tasks
                          </div>
                          {recentTasks.map((task) => {
                            const isUnseen = !seenTaskIds.has(task.id)
                            return (
                              <DropdownMenuItem
                                key={task.id}
                                className={cn(
                                  "flex flex-col items-start gap-1 p-3 cursor-pointer",
                                  isUnseen && "bg-blue-50/50 dark:bg-blue-950/20"
                                )}
                                onClick={() => {
                                  // Mark as seen when clicked
                                  setSeenTaskIds(prev => new Set([...prev, task.id]))
                                  router.push(`/tasks/${task.id}`)
                                }}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <CheckSquare2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{task.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {task.assignedBy?.name || 'Someone'} created this task
                                      {task.assignedTo && ` • Assigned to ${task.assignedTo.name}`}
                                    </div>
                                    {(task.createdAt || (task as any).timestamp) && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {formatNotificationTime(task.createdAt || (task as any).timestamp)}
                                      </div>
                                    )}
                                  </div>
                                  {isUnseen && (
                                    <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                                  )}
                                </div>
                              </DropdownMenuItem>
                            )
                          })}
                        </div>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {taskNotifications > 0 && (
                      <div className="p-2">
                        <DropdownMenuItem
                          className="flex items-center justify-center p-2 cursor-pointer"
                          onClick={() => {
                            // Mark all tasks as seen when viewing all tasks
                            setSeenTaskIds(prev => {
                              const newSet = new Set(prev)
                              recentTasks.forEach(task => newSet.add(task.id))
                              return newSet
                            })
                            router.push('/tasks')
                          }}
                        >
                          <span className="text-sm font-medium">
                            View all {taskNotifications} pending task{taskNotifications !== 1 ? 's' : ''}
                          </span>
                        </DropdownMenuItem>
                      </div>
                    )}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(session.user.name || 'U')}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user.email}
                    </p>
                    <Badge variant={getRoleBadgeVariant(role)} className="mt-2 w-fit">
                      {role.replace('_', ' ')}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Global Search Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search pages, tasks, clients..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {searchItems.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => {
                  router.push(item.href)
                  setSearchOpen(false)
                }}
              >
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

