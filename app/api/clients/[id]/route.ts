import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
        accountManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tasks: {
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
              },
            },
            assignedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        doctors: {
          orderBy: { createdAt: 'asc' },
        },
        clientServices: {
          orderBy: { createdAt: 'asc' },
        },
        usps: {
          orderBy: { createdAt: 'asc' },
        },
        accesses: {
          orderBy: { type: 'asc' },
        },
        assets: {
          orderBy: { createdAt: 'desc' },
        },
        branding: true,
        targeting: true,
        competitors: {
          orderBy: { createdAt: 'asc' },
        },
        marketingRequirements: true,
        approvalSettings: true,
        kpis: {
          orderBy: { month: 'desc' },
        },
        clientTasks: {
          include: {
            assignedTo: {
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

