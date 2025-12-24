export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!params.id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        Task: {
          include: {
            User_Task_assignedToIdToUser: {
              select: {
                id: true,
                name: true,
              },
            },
            User_Task_assignedByIdToUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        client_doctors: {
          orderBy: { createdAt: 'asc' },
        },
        client_services: {
          orderBy: { createdAt: 'asc' },
        },
        client_usps: {
          orderBy: { createdAt: 'asc' },
        },
        client_accesses: {
          orderBy: { type: 'asc' },
        },
        client_assets: {
          orderBy: { createdAt: 'desc' },
        },
        client_branding: true,
        client_targeting: true,
        client_competitors: {
          orderBy: { createdAt: 'asc' },
        },
        client_marketing_requirements: true,
        client_approval_settings: true,
        client_kpi_monthly: {
          orderBy: { month: 'desc' },
        },
        client_tasks: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [
            { month: 'desc' },
            { createdAt: 'asc' },
          ],
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error: any) {
    console.error('Error fetching client:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    })
    
    // Return more specific error messages
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

