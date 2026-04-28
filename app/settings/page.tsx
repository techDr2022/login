export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { Card } from '@/components/ui/card'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { NotificationsSettings } from '@/components/settings/notifications-settings'
import { PhoneNumberForm } from '@/components/settings/phone-number-form'
import { SubscriptionSettings } from '@/components/settings/subscription-settings'
import { ProfileForm } from '@/components/settings/profile-form'
import { prisma } from '@/lib/prisma'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const user = session.user
  
  // Fetch user profile details from database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      jobTitle: true,
      phoneNumber: true,
    },
  })

  return (
    <LayoutWrapper>
      <div className="space-y-6 max-w-3xl">
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Profile settings</h2>
            <p className="text-sm text-muted-foreground">
              Update your personal email and designation.
            </p>
          </div>
          <ProfileForm
            currentName={dbUser?.name || user.name || ''}
            currentEmail={dbUser?.email || user.email || ''}
            currentJobTitle={dbUser?.jobTitle || ''}
          />
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Contact Information</h2>
            <p className="text-sm text-muted-foreground">
              Update your WhatsApp phone number for notifications.
            </p>
          </div>
          <PhoneNumberForm currentPhoneNumber={dbUser?.phoneNumber} />
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

        <SubscriptionSettings />
      </div>
    </LayoutWrapper>
  )
}


