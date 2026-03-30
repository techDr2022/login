export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Serve local files (for local storage adapter)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await context.params
    
    // Decode the key in case it was URL encoded
    let decodedKey: string
    try {
      decodedKey = decodeURIComponent(key)
    } catch (e) {
      // If decoding fails, use the original key
      decodedKey = key
    }
    
    // Security: Prevent directory traversal attacks
    if (decodedKey.includes('..')) {
      console.error('Directory traversal attempt detected:', decodedKey)
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    // Construct the file path - keys are stored directly in the client-assets folder
    const uploadsDir = join(process.cwd(), 'uploads', 'client-assets')
    const filePath = join(uploadsDir, decodedKey)

    // Log for debugging
    console.log('File request:', {
      originalKey: key,
      decodedKey,
      filePath,
      uploadsDirExists: existsSync(uploadsDir),
      fileExists: existsSync(filePath),
    })

    if (!existsSync(filePath)) {
      // List files in directory for debugging
      const fs = await import('fs/promises')
      let filesInDir: string[] = []
      try {
        filesInDir = await fs.readdir(uploadsDir)
      } catch (e) {
        console.error('Cannot read uploads directory:', e)
      }
      
      console.error('File not found:', {
        requestedKey: decodedKey,
        filePath,
        filesInDirectory: filesInDir.slice(0, 10), // First 10 files
        cwd: process.cwd(),
      })
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = await readFile(filePath)
    const ext = key.split('.').pop()?.toLowerCase()
    
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

