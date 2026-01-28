import { randomBytes } from 'crypto'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

interface StorageAdapter {
  upload(file: Buffer, filename: string, mimeType?: string): Promise<string>
  getUrl(key: string): Promise<string>
  delete(key: string): Promise<void>
}

// S3-compatible storage adapter (requires @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner)
class S3StorageAdapter implements StorageAdapter {
  private bucket: string
  private region: string

  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME || ''
    this.region = process.env.S3_REGION || 'us-east-1'
  }

  async upload(file: Buffer, filename: string, mimeType?: string): Promise<string> {
    try {
      // Dynamic import to avoid errors if AWS SDK is not installed
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      
      const client = new S3Client({
        region: this.region,
        credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        } : undefined,
        endpoint: process.env.S3_ENDPOINT, // For Cloudflare R2 or other S3-compatible services
      })

      const key = `client-assets/${Date.now()}-${randomBytes(8).toString('hex')}-${filename}`
      
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: mimeType,
        })
      )
      
      return key
    } catch (error) {
      console.error('S3 upload failed, falling back to local storage:', error)
      throw new Error('S3 upload failed')
    }
  }

  async getUrl(key: string): Promise<string> {
    try {
      // Dynamic import to avoid errors if AWS SDK is not installed
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      
      const client = new S3Client({
        region: this.region,
        credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        } : undefined,
        endpoint: process.env.S3_ENDPOINT,
      })

      // Generate a signed URL valid for 1 hour
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
      
      return await getSignedUrl(client, command, { expiresIn: 3600 })
    } catch (error) {
      console.error('S3 URL generation failed:', error)
      throw new Error('S3 URL generation failed')
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Dynamic import to avoid errors if AWS SDK is not installed
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      
      const client = new S3Client({
        region: this.region,
        credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        } : undefined,
        endpoint: process.env.S3_ENDPOINT,
      })

      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      )
    } catch (error) {
      console.error('S3 delete failed:', error)
      throw new Error('S3 delete failed')
    }
  }
}

// Local file storage adapter (fallback)
class LocalStorageAdapter implements StorageAdapter {
  private basePath: string

  constructor() {
    this.basePath = join(process.cwd(), 'uploads', 'client-assets')
    this.ensureDirectoryExists()
  }

  private async ensureDirectoryExists() {
    if (!existsSync(this.basePath)) {
      await mkdir(this.basePath, { recursive: true })
    }
  }

  async upload(file: Buffer, filename: string, mimeType?: string): Promise<string> {
    await this.ensureDirectoryExists()
    
    // Sanitize filename to remove problematic characters
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `${Date.now()}-${randomBytes(8).toString('hex')}-${sanitizedFilename}`
    const filePath = join(this.basePath, key)
    
    try {
      await writeFile(filePath, file)
      console.log('File saved successfully:', { key, filePath, size: file.length })
      
      // Verify file was written
      if (!existsSync(filePath)) {
        throw new Error('File was not written to disk')
      }
    } catch (error) {
      console.error('Failed to write file:', { key, filePath, error })
      throw error
    }
    
    return key
  }

  async getUrl(key: string): Promise<string> {
    // Return a path that can be served by Next.js
    return `/api/files/${key}`
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key)
    if (existsSync(filePath)) {
      await unlink(filePath)
    }
  }
}

// Factory function to get the appropriate storage adapter
export function getStorageAdapter(): StorageAdapter {
  const useS3 = process.env.S3_BUCKET_NAME && 
                process.env.S3_ACCESS_KEY_ID && 
                process.env.S3_SECRET_ACCESS_KEY

  if (useS3) {
    try {
      return new S3StorageAdapter()
    } catch (error) {
      console.warn('Failed to initialize S3 storage, falling back to local storage:', error)
      return new LocalStorageAdapter()
    }
  }

  return new LocalStorageAdapter()
}

// Helper to get file URL (for use in API routes)
export async function getFileUrl(key: string): Promise<string> {
  const adapter = getStorageAdapter()
  return adapter.getUrl(key)
}

