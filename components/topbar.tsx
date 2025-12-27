'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { UserRole } from '@prisma/client'
import { Bell, Search, User, LogOut, Settings } from 'lucide-react'
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
  const [notifications, setNotifications] = useState(0)

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

  useEffect(() => {
    // Fetch notification count
    const fetchNotifications = async () => {
      try {
        // TODO: Replace with actual notification API
        // const res = await fetch('/api/notifications/unread')
        // const data = await res.json()
        // setNotifications(data.count || 0)
      } catch (error) {
        console.error('Failed to fetch notifications:', error)
      }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notifications > 0 && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No new notifications
                  </div>
                ) : (
                  <div className="p-2">
                    {/* TODO: Add actual notification items */}
                    <div className="text-sm text-muted-foreground">
                      {notifications} new notification{notifications !== 1 ? 's' : ''}
                    </div>
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

