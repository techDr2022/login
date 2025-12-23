export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Serve local files (for local storage adapter)
export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const filePath = join(process.cwd(), 'uploads', 'client-assets', params.key)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = await readFile(filePath)
    const ext = params.key.split('.').pop()?.toLowerCase()
    
    // Determine content type
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
    }

    const contentType = contentTypeMap[ext || ''] || 'application/octet-stream'

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

