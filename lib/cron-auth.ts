import { NextRequest } from 'next/server'

/**
 * Vercel Cron forwards CRON_SECRET as `Authorization: Bearer <secret>`.
 * Manual testing can use `?secret=<CRON_SECRET>`.
 */
export function isCronRequestAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return true

  if (request.nextUrl.searchParams.get('secret') === cronSecret) return true

  const auth = request.headers.get('authorization')?.trim()
  return auth === `Bearer ${cronSecret}`
}
