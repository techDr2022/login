'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateEngineStatus } from '@/app/actions/engine-actions'
import { actionLabel } from '@/lib/engine/rules'

export function EngineStatusButtons({
  taskId,
  status,
  actions,
}: {
  taskId: string
  status: string
  actions: string[]
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
    <div className="flex flex-wrap gap-2">
      {actions.map((to) => (
        <Button key={to} size="sm" variant={to === 'Done' ? 'default' : 'outline'} disabled={!!pending} onClick={() => run(to)}>
          {pending === to ? 'Saving' : actionLabel(status, to)}
        </Button>
      ))}
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </div>
  )
}
