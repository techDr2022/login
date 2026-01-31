export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import {
  verifyInvoicesPassword,
  setInvoicesUnlockedCookie,
} from '@/lib/invoices-unlock'

type Body = { method: 'password'; password: string }

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as Body
    if (body?.method !== 'password') {
      return NextResponse.json(
        { error: 'Invalid request. Use method: "password".' },
        { status: 400 }
      )
    }

    const password = typeof body.password === 'string' ? body.password : ''
    if (!process.env.INVOICES_UNLOCK_PASSWORD) {
      return NextResponse.json(
        { error: 'Invoices unlock password is not configured.' },
        { status: 400 }
      )
    }

    if (!verifyInvoicesPassword(password)) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
    }

    await setInvoicesUnlockedCookie(session.user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[invoices unlock]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unlock failed.' },
      { status: 500 }
    )
  }
}
