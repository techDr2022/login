import Link from 'next/link'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function timeGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const PILL_STYLES: Record<string, string> = {
  Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Present: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Review: 'bg-amber-50 text-amber-800 ring-amber-200',
  Late: 'bg-amber-50 text-amber-800 ring-amber-200',
  Medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  HalfDay: 'bg-orange-50 text-orange-700 ring-orange-200',
  High: 'bg-orange-50 text-orange-700 ring-orange-200',
  InProgress: 'bg-sky-50 text-sky-700 ring-sky-200',
  Low: 'bg-sky-50 text-sky-700 ring-sky-200',
  Pending: 'bg-slate-100 text-slate-700 ring-slate-200',
  Rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  Absent: 'bg-rose-50 text-rose-700 ring-rose-200',
  Urgent: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const PILL_LABELS: Record<string, string> = {
  InProgress: 'In progress',
  HalfDay: 'Half day',
}

export function StatusBadge({ value }: { value?: string | null }) {
  if (!value) return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        PILL_STYLES[value] || 'bg-slate-100 text-slate-700 ring-slate-200'
      )}
    >
      {PILL_LABELS[value] || value}
    </span>
  )
}

type Tone = 'emerald' | 'sky' | 'amber' | 'orange' | 'violet' | 'rose'

const TONES: Record<Tone, { bar: string; icon: string }> = {
  emerald: { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600' },
  sky: { bar: 'bg-sky-500', icon: 'bg-sky-50 text-sky-600' },
  amber: { bar: 'bg-amber-400', icon: 'bg-amber-50 text-amber-600' },
  orange: { bar: 'bg-orange-500', icon: 'bg-orange-50 text-orange-600' },
  violet: { bar: 'bg-violet-500', icon: 'bg-violet-50 text-violet-600' },
  rose: { bar: 'bg-rose-500', icon: 'bg-rose-50 text-rose-600' },
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'sky',
}: {
  label: string
  value: ReactNode
  hint?: string
  icon: LucideIcon
  tone?: Tone
}) {
  const colors = TONES[tone]
  const plain = typeof value === 'string' || typeof value === 'number'
  const longText = typeof value === 'string' && value.length > 8
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn('absolute inset-x-0 top-0 h-1', colors.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className={cn('mt-2 font-semibold tracking-tight', plain && (longText ? 'text-xl' : 'text-3xl'))}>{value}</div>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', colors.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export function WelcomeBanner({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-700 px-5 py-6 text-white shadow-sm sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute -right-8 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-36 w-36 rounded-full bg-indigo-300/30 blur-2xl" />
      <div className="relative">
        <p className="text-sm font-medium text-indigo-100">{kicker}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200">{subtitle}</p>
        {children ? <div className="mt-5 flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </section>
  )
}

export function QuickLink({
  href,
  icon: Icon,
  children,
}: {
  href: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/20"
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  )
}

export function Panel({
  title,
  description,
  icon: Icon,
  href,
  actionLabel = 'View all',
  tone = 'default',
  children,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  href?: string
  actionLabel?: string
  tone?: 'default' | 'warning'
  children: ReactNode
}) {
  const warning = tone === 'warning'
  return (
    <section
      className={cn(
        'flex h-full flex-col rounded-2xl border shadow-sm',
        warning ? 'border-amber-300 bg-amber-50 shadow-amber-100/80' : 'bg-card'
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className={cn('text-base font-semibold tracking-tight', warning && 'text-amber-950')}>{title}</h2>
          {description ? (
            <p className={cn('mt-0.5 text-sm', warning ? 'font-medium text-amber-800' : 'text-muted-foreground')}>
              {description}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              warning ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-600'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <div className="flex-1 px-3 py-3 sm:px-4">{children}</div>
      {href ? (
        <div className={cn('border-t px-3 py-2', warning && 'border-amber-200')}>
          <Link
            href={href}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition',
              warning
                ? 'text-amber-900 hover:bg-amber-100'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </section>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 px-4 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function TaskLinkRow({
  href,
  title,
  meta,
  badges,
  tone = 'default',
}: {
  href: string
  title: string
  meta?: string
  badges?: ReactNode
  tone?: 'default' | 'warning'
}) {
  const warning = tone === 'warning'
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-2 py-2.5 transition',
        warning ? 'bg-amber-100/80 ring-1 ring-inset ring-amber-200 hover:bg-amber-100' : 'hover:bg-slate-50'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', warning ? 'text-amber-950' : 'group-hover:text-indigo-700')}>
          {title}
        </p>
        {meta ? (
          <p className={cn('mt-0.5 truncate text-xs', warning ? 'text-amber-800' : 'text-muted-foreground')}>{meta}</p>
        ) : null}
      </div>
      {badges ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{badges}</div> : null}
    </Link>
  )
}
