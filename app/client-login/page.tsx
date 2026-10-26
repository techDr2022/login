'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ClientLoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.push(session.user.role === 'CLIENT' ? '/portal' : '/dashboard')
    }
  }, [status, session, router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const login = username.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,32}$/.test(login) || !password) {
      setError('Enter your username and password')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: login,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError('Invalid username or password')
        setLoading(false)
        return
      }
      const sessionRes = await fetch('/api/auth/session')
      const nextSession = await sessionRes.json().catch(() => null)
      if (nextSession?.user?.role !== 'CLIENT') {
        await signOut({ redirect: false })
        setError('This login is for clients. Staff should use the staff login.')
        setLoading(false)
        return
      }
      router.push('/portal')
      router.refresh()
    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (status === 'authenticated') return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Client login</h1>
          <p className="mt-1 text-sm text-muted-foreground">See the work happening for your clinic</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the username your team gave you</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Staff? <Link className="text-primary underline" href="/login">Sign in here</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
