'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { regenerateBoardToken, runSchedulerNow, setEngineEnabled } from '@/app/actions/engine-actions'

export function AdminEngineCard({
  enabled,
  boardPath,
}: {
  enabled: boolean
  boardPath: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function run(action: () => Promise<unknown>) {
    setPending(true)
    setMessage('')
    try {
      const result = await action()
      setMessage(result && typeof result === 'object' && 'created' in result ? `Created ${String((result as { created: number }).created)} tasks` : 'Saved')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Work engine</h2>
        <p className="text-sm text-muted-foreground">Scheduler, unlocks and escalation follow this switch. No redeploy.</p>
      </div>
      <p className="text-sm">Engine is {enabled ? 'on' : 'off'}.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => run(() => setEngineEnabled(!enabled))}>
          {enabled ? 'Turn engine off' : 'Turn engine on'}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run(() => runSchedulerNow())}>
          Run scheduler now
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Public board</p>
        <p className="break-all text-sm text-muted-foreground">{boardPath}</p>
        <Button variant="outline" disabled={pending} onClick={() => run(() => regenerateBoardToken())}>
          Regenerate link
        </Button>
      </div>
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}
