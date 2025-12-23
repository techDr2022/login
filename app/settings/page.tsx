export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ChangePasswordForm } from '@/components/settings/change-password-form'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const user = session.user

  return (
    <LayoutWrapper>
      <div className="space-y-6 max-w-3xl">
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Profile settings</h2>
            <p className="text-sm text-muted-foreground">
              Basic information about your account. (Read-only for now)
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={user.name ?? ''} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email ?? ''} readOnly />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Control which alerts you receive. (Non-functional demo toggles)
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Task updates</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when tasks assigned to you change.
                </p>
              </div>
              <Checkbox aria-label="Task updates" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Client changes</p>
                <p className="text-xs text-muted-foreground">
                  Alerts for new clients or major onboarding updates.
                </p>
              </div>
              <Checkbox aria-label="Client changes" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Chat mentions</p>
                <p className="text-xs text-muted-foreground">
                  Notifications when someone mentions you in team chat.
                </p>
              </div>
              <Checkbox aria-label="Chat mentions" />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Security</h2>
            <p className="text-sm text-muted-foreground">
              Change your account password.
            </p>
          </div>
          <ChangePasswordForm />
        </Card>
      </div>
    </LayoutWrapper>
  )
}


