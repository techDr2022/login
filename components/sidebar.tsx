'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Users,
  UserCog,
  Clock,
  MessageCircle,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronLeft,
  Palette,
  Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/designer', label: 'Designer Workspace', icon: Palette },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/employees', label: 'Employees', icon: UserCog, roles: [UserRole.SUPER_ADMIN] },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/chat', label: 'Team Chat', icon: MessageCircle },
  { href: '/invoices', label: 'Invoices', icon: Receipt, roles: [UserRole.SUPER_ADMIN] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: [UserRole.SUPER_ADMIN] },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    // Update CSS variable for sidebar width
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isCollapsed ? '64px' : '256px'
    )
  }, [isCollapsed])

  if (!session) return null

  const role = session.user.role as UserRole
  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Briefcase className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">TechDr - Team</span>
          </Link>
        )}
        {isCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground mx-auto">
            <Briefcase className="h-5 w-5" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <TooltipProvider key={item.href}>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <Button
                      variant={active ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-3 rounded-xl',
                        isCollapsed && 'justify-center px-2',
                        active && 'bg-secondary font-medium'
                      )}
                      onClick={() => setIsMobileOpen(false)}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </Button>
                  </Link>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </nav>

      {/* Collapse Toggle (Desktop) */}
      <div className="hidden border-t p-4 md:block">
        <Button
          variant="ghost"
          size="icon"
          className="w-full rounded-xl"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')}
          />
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-background border-r">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden h-screen border-r bg-background transition-all duration-300 md:fixed md:flex md:flex-col z-30',
          isCollapsed ? 'w-16' : 'w-64'
        )}
        style={{ width: isCollapsed ? '64px' : '256px' }}
      >
        <SidebarContent />
      </aside>
    </>
  )
}

