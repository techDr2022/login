export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { NotificationsSettings } from '@/components/settings/notifications-settings'

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
          <NotificationsSettings />
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


