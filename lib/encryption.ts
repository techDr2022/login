import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

// Get encryption key from environment or use a default (for development only)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    // In production, this should be set in environment variables
    console.warn('ENCRYPTION_KEY not set, using default key (NOT SECURE FOR PRODUCTION)')
    return crypto.scryptSync('default-key-change-in-production', 'salt', KEY_LENGTH)
  }
  return Buffer.from(key, 'hex')
}

/**
 * Encrypts a string value
 */
export function encrypt(value: string): string {
  if (!value) return value
  
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(value, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Combine iv, tag, and encrypted data
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted
}

/**
 * Decrypts an encrypted string value
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue
  
  try {
    const parts = encryptedValue.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format')
    }
    
    const [ivHex, tagHex, encrypted] = parts
    const key = getEncryptionKey()
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt value')
  }
}

