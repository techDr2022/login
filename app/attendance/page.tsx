import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { AttendancePage } from '@/components/attendance/attendance-page'

export default async function Attendance() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  return (
    <LayoutWrapper>
      <div className="space-y-6">
        <AttendancePage />
      </div>
    </LayoutWrapper>
  )
}

