import { createHmac, timingSafeEqual } from 'crypto'

type ExtensionTokenPayload = {
  uid: string
  role: string
  exp: number
}

function getSecret(): string {
  const secret = process.env.EXTENSION_AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('EXTENSION_AUTH_SECRET (or NEXTAUTH_SECRET) is required')
  }
  return secret
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(input: string): string {
  return createHmac('sha256', getSecret()).update(input).digest('base64url')
}

export function createExtensionToken(userId: string, role: string, ttlHours = 24 * 14): string {
  const payload: ExtensionTokenPayload = {
    uid: userId,
    role,
    exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
  }
  const payloadEncoded = toBase64Url(JSON.stringify(payload))
  const sig = sign(payloadEncoded)
  return `${payloadEncoded}.${sig}`
}

export function verifyExtensionToken(token: string): ExtensionTokenPayload {
  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new Error('Invalid token format')
  }
  const [payloadEncoded, sig] = parts
  const expectedSig = sign(payloadEncoded)
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid token signature')
  }

  const payload = JSON.parse(fromBase64Url(payloadEncoded)) as ExtensionTokenPayload
  if (!payload.uid || !payload.role || !payload.exp) {
    throw new Error('Invalid token payload')
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }
  return payload
}

