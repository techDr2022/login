import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageClients } from '@/lib/rbac'
import { UserRole } from '@prisma/client'
import { getStorageAdapter } from '@/lib/storage'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageClients(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const clientId = formData.get('clientId') as string
    const type = formData.get('type') as string
    const category = formData.get('category') as string
    const title = formData.get('title') as string

    if (!file || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: file and type are required' },
        { status: 400 }
      )
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required. Please complete Step 1 (Basic Info) first to create the client.' },
        { status: 400 }
      )
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found. Please complete Step 1 (Basic Info) first.' },
        { status: 404 }
      )
    }

    // Verify user exists in database
    // Try to find by ID first, then by email as fallback
    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    // If user not found by ID, try to find by email (session might have email)
    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
      })
      if (user) {
        console.warn(`User found by email but ID mismatch. Session ID: ${session.user.id}, DB ID: ${user.id}`)
      }
    }

    if (!user) {
      console.error('User not found in database:', {
        sessionUserId: session.user.id,
        sessionUserEmail: session.user.email,
        sessionUserName: session.user.name,
      })
      return NextResponse.json(
        { 
          error: 'User not found in database. This usually means your session is out of sync. Please log out and log back in to refresh your session.',
          details: 'Session user ID does not match any user in the database.'
        },
        { status: 404 }
      )
    }

    // Use the found user's ID (in case we found by email)
    const userId = user.id

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to storage
    let key: string
    let url: string
    
    try {
      const storage = getStorageAdapter()
      key = await storage.upload(buffer, file.name, file.type)
      url = await storage.getUrl(key)
    } catch (storageError: any) {
      console.error('Storage upload error:', storageError)
      return NextResponse.json(
        { error: `Storage error: ${storageError.message || 'Failed to upload file'}` },
        { status: 500 }
      )
    }

    // Save to database
    let asset
    try {
      asset = await prisma.clientAsset.create({
        data: {
          clientId,
          type: type as any,
          category: category ? (category as any) : null,
          title: title || file.name,
          url: key,
          mimeType: file.type,
          size: file.size,
          uploadedById: userId,
        },
      })
    } catch (dbError: any) {
      console.error('Database error:', dbError)
      console.error('Session user ID:', session.user.id)
      console.error('Client ID:', clientId)
      // Try to clean up uploaded file
      try {
        const storage = getStorageAdapter()
        await storage.delete(key)
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError)
      }
      return NextResponse.json(
        { error: `Database error: ${dbError.message || 'Failed to save file record'}. Please check that the user and client exist in the database.` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: asset.id,
      url,
      key,
      title: asset.title,
      type: asset.type,
      category: asset.category,
    })
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageClients(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID required' }, { status: 400 })
    }

    // Get asset
    const asset = await prisma.clientAsset.findUnique({
      where: { id: assetId },
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Delete from storage
    const storage = getStorageAdapter()
    await storage.delete(asset.url)

    // Delete from database
    await prisma.clientAsset.delete({
      where: { id: assetId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting file:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

