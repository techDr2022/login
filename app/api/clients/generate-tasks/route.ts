export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateTasksForExistingClient, generateTasksForAllEligibleClients } from '@/app/actions/client-actions'

// Generate tasks for a specific client
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clientId, generateForAll } = body

    if (generateForAll) {
      // Generate tasks for all eligible clients
      const result = await generateTasksForAllEligibleClients()
      return NextResponse.json(result)
    } else if (clientId) {
      // Generate tasks for a specific client
      const result = await generateTasksForExistingClient(clientId)
      return NextResponse.json(result)
    } else {
      return NextResponse.json(
        { error: 'Either clientId or generateForAll must be provided' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error generating tasks:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

