'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateEngineStatus } from '@/app/actions/engine-actions'
import { actionLabel } from '@/lib/engine/rules'
import { cn } from '@/lib/utils'

function shortAction(from: string, to: string) {
  if (to === 'InReview') return 'Review'
  if (to === 'WaitingOnInput') return 'Waiting'
  if (to === 'Cancelled') return 'Cancel'
  if (to === 'ToDo' && from === 'InReview') return 'Changes'
  return actionLabel(from, to)
}

export function EngineStatusButtons({
  taskId,
  status,
  actions,
  compact = false,
}: {
  taskId: string
  status: string
  actions: string[]
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')

  async function run(to: string) {
    setError('')
    let waitingName = ''
    let reason = ''
    if (to === 'WaitingOnInput') {
      waitingName = window.prompt('Who are you waiting on? Use their first name.') || ''
      if (!waitingName.trim()) return
    }
    if (status === 'Done' && to === 'ToDo') {
      reason = window.prompt('Reason to reopen') || ''
      if (!reason.trim()) return
    }
    setPending(to)
    try {
      await updateEngineStatus(taskId, to, { waitingName, reason })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update')
    } finally {
      setPending('')
    }
  }

  if (!actions.length) return null
  return (
    <div className={cn('flex flex-wrap gap-2', compact && 'shrink-0 flex-nowrap gap-1')}>
      {actions.map((to) => (
        <Button
          key={to}
          size="sm"
          variant={to === 'Done' ? 'default' : 'outline'}
          className={compact ? 'h-7 px-2 text-xs' : undefined}
          disabled={!!pending}
          onClick={() => run(to)}
        >
          {pending === to ? 'Saving' : compact ? shortAction(status, to) : actionLabel(status, to)}
        </Button>
      ))}
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  )
}
