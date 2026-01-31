import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'invoices_unlocked'
const COOKIE_MAX_AGE = 30 * 60 // 30 minutes in seconds

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for invoices unlock')
  return secret
}

function signPayload(payload: { userId: string; exp: number }): string {
  const secret = getSecret()
  const data = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(data)
  const sig = hmac.digest('hex')
  return Buffer.from(data).toString('base64url') + '.' + sig
}

function verifyPayload(token: string): { userId: string; exp: number } | null {
  try {
    const [raw, sig] = token.split('.')
    if (!raw || !sig) return null
    const data = Buffer.from(raw, 'base64url').toString('utf8')
    const payload = JSON.parse(data) as { userId: string; exp: number }
    const secret = getSecret()
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(data)
    const expected = hmac.digest('hex')
    if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')) && payload.exp > Date.now() / 1000) {
      return payload
    }
  } catch {
    // ignore
  }
  return null
}

/** Check if the request has a valid invoices-unlock cookie for the given userId. */
export async function isInvoicesUnlockedForUser(userId: string): Promise<boolean> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  if (!cookie?.value) return false
  const payload = verifyPayload(cookie.value)
  return payload !== null && payload.userId === userId
}

/** Set the invoices-unlock cookie for the given userId (call from API route after successful verify). */
export async function setInvoicesUnlockedCookie(userId: string): Promise<void> {
  const cookieStore = await cookies()
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE
  const value = signPayload({ userId, exp })
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

/** Verify password against INVOICES_UNLOCK_PASSWORD. Returns true if correct. */
export function verifyInvoicesPassword(password: string): boolean {
  const envPassword = process.env.INVOICES_UNLOCK_PASSWORD
  if (!envPassword) return false
  return password === envPassword
}

/** Read and verify invoices-unlock cookie from request (for API routes that receive Request). */
export async function getInvoicesUnlockUserIdFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`))
  const token = match?.[1]
  if (!token) return null
  const payload = verifyPayload(decodeURIComponent(token))
  return payload?.userId ?? null
}
