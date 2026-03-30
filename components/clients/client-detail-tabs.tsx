'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Edit, Plus, Eye, EyeOff, Download, Phone, Mail, MapPin, Calendar, Clock, Globe, MessageCircle, CheckCircle2, XCircle, Building2, Users } from 'lucide-react'
import Link from 'next/link'
import { getClientAccessWithPassword } from '@/app/actions/client-onboarding-actions'
import { decrypt } from '@/lib/encryption'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { canManageClients, canEditClient } from '@/lib/rbac'
import { generateTasksForMonth } from '@/app/actions/client-onboarding-actions'
import { EditClientDialog } from './edit-client-dialog'

interface ClientDetailTabsProps {
  clientId: string
}

export function ClientDetailTabs({ clientId }: ClientDetailTabsProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({})
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const canManage = session?.user.role && canManageClients(session.user.role as UserRole)
  const canEdit = session?.user.role && canEditClient(session.user.role as UserRole)

  useEffect(() => {
    if (clientId) {
      fetchClient()
    }
  }, [clientId])

  const fetchClient = async () => {
    if (!clientId) {
      setError('Client ID is required')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      console.log('Fetching client with ID:', clientId)
      const res = await fetch(`/api/clients/${clientId}`)
      
      if (!res.ok) {
        if (res.status === 404) {
          setError('Client not found')
        } else if (res.status === 401) {
          setError('Unauthorized. Please log in again.')
        } else {
          const errorData = await res.json().catch(() => ({}))
          setError(errorData.error || `Failed to load client (${res.status})`)
        }
        setClient(null)
        return
      }

      const data = await res.json()
      console.log('Client data received:', data)
      if (!data || !data.id) {
        setError('Invalid client data received')
        setClient(null)
        return
      }
      
      // Normalize field names to handle both camelCase and snake_case from API
      const branding = data.branding || data.client_branding
      const targeting = data.targeting || data.client_targeting
      
      const normalizedData = {
        ...data,
        // Normalize related data arrays
        doctors: data.doctors || data.client_doctors || [],
        services: data.clientServices || data.client_services || [],
        usps: data.usps || data.client_usps || [],
        accesses: data.accesses || data.client_accesses || [],
        assets: data.assets || data.client_assets || [],
        competitors: data.competitors || data.client_competitors || [],
        // Normalize related objects with JSON parsing
        branding: branding ? {
          ...branding,
          brandColors: branding.brandColors 
            ? (typeof branding.brandColors === 'string' 
                ? (branding.brandColors.trim() ? JSON.parse(branding.brandColors) : null)
                : branding.brandColors)
            : null
        } : null,
        targeting: targeting ? {
          ...targeting,
          nearbyAreas: targeting.nearbyAreas
            ? (Array.isArray(targeting.nearbyAreas) 
                ? targeting.nearbyAreas 
                : (typeof targeting.nearbyAreas === 'string' && targeting.nearbyAreas.trim()
                    ? JSON.parse(targeting.nearbyAreas)
                    : []))
            : [],
          mainKeywords: targeting.mainKeywords
            ? (Array.isArray(targeting.mainKeywords)
                ? targeting.mainKeywords
                : (typeof targeting.mainKeywords === 'string' && targeting.mainKeywords.trim()
                    ? JSON.parse(targeting.mainKeywords)
                    : []))
            : []
        } : null,
        marketingRequirements: data.marketingRequirements || data.client_marketing_requirements || null,
        approvalSettings: data.approvalSettings || data.client_approval_settings || null,
        kpis: data.kpis || data.client_kpi_monthly || [],
        tasks: data.Task || data.tasks || [],
      }
      
      setClient(normalizedData)
    } catch (err: any) {
      console.error('Failed to fetch client:', err)
      setError(err.message || 'Failed to load client. Please try again.')
      setClient(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRevealPassword = async (accessId: string) => {
    if (revealedPasswords[accessId]) {
      setRevealedPasswords({ ...revealedPasswords, [accessId]: false })
      return
    }

    try {
      const access = await getClientAccessWithPassword(accessId)
      if (access?.password) {
        // Store the decrypted password temporarily
        setRevealedPasswords({ ...revealedPasswords, [accessId]: true })
        // Store the actual password in a separate state for display
        setClient((prev: any) => {
          if (!prev) return prev
          const updatedAccesses = prev.accesses.map((a: any) =>
            a.id === accessId ? { ...a, decryptedPassword: access.password } : a
          )
          return { ...prev, accesses: updatedAccesses }
        })
      }
    } catch (err) {
      console.error('Failed to reveal password:', err)
    }
  }

  const handleGenerateTasks = async (month: string) => {
    if (!confirm(`Generate tasks for ${month}?`)) return

    try {
      await generateTasksForMonth(clientId, month)
      fetchClient()
    } catch (err: any) {
      alert(err.message || 'Failed to generate tasks')
    }
  }

  const handleDownloadPdf = async () => {
    if (!clientId) return

    setDownloadingPdf(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/pdf`)
      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const clientName = client?.name?.replace(/[^a-z0-9]/gi, '_') || clientId
      a.download = `client-onboarding-${clientName}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      console.error('Failed to download PDF:', err)
      alert(err.message || 'Failed to download PDF. Please try again.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading client...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchClient} variant="outline">
          Retry
        </Button>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Alert>
          <AlertDescription>Client not found</AlertDescription>
        </Alert>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      ONBOARDING: 'secondary',
      ACTIVE: 'default',
      PAUSED: 'outline',
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  // Calculate statistics - use normalized fields
  const tasks = client.tasks || []
  const doctors = client.doctors || []
  const services = client.services || []
  const kpis = client.kpis || []
  
  const stats = {
    totalTasks: tasks.length || 0,
    pendingTasks: tasks.filter((t: any) => t.status === 'Pending').length || 0,
    inProgressTasks: tasks.filter((t: any) => t.status === 'InProgress').length || 0,
    completedTasks: tasks.filter((t: any) => t.status === 'Approved').length || 0,
    doctorsCount: doctors.length || 0,
    servicesCount: services.length || 0,
    kpisCount: kpis.length || 0,
  }

  // Parse working days if available
  const workingDays = client.workingDays ? (typeof client.workingDays === 'string' ? JSON.parse(client.workingDays) : client.workingDays) : null

  // Find profile picture - prioritize doctor photos, then logo, then any photo
  const assets = client.assets || []
  
  // Get asset URL - URLs should already be normalized by the API
  const getAssetUrl = (asset: any) => {
    if (!asset?.url) return null
    return asset.url
  }
  
  // Find the best profile picture in priority order:
  // 1. PHOTO type (doctor photos)
  // 2. LOGO type
  // 3. Any image asset
  const photoAsset = assets.find((asset: any) => asset.type === 'PHOTO')
  const logoAsset = assets.find((asset: any) => asset.type === 'LOGO')
  const anyImageAsset = assets.find((asset: any) => 
    asset.mimeType?.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(asset.url || '')
  )
  
  const profileAsset = photoAsset || logoAsset || anyImageAsset
  const profilePicUrl = profileAsset ? getAssetUrl(profileAsset) : null

  // Get client initials for fallback
  const getClientInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <Button variant="ghost" onClick={() => router.back()} className="mt-1">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Avatar className="h-14 w-14 rounded-lg border">
                {profilePicUrl ? (
                  <AvatarImage src={profilePicUrl} alt={`${client.name || client.doctorOrHospitalName}`} />
                ) : null}
                <AvatarFallback className="rounded-lg text-lg">
                  {getClientInitials(client.name || client.doctorOrHospitalName || 'U')}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-3xl font-bold">{client.name || client.doctorOrHospitalName || 'Unnamed Client'}</h1>
              {getStatusBadge(client.status || 'ONBOARDING')}
              {client.type && <Badge variant="outline" className="text-xs">{client.type}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {client.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{client.location}</span>
                </div>
              )}
              {client.phonePrimary && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{client.phonePrimary}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.createdAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Created {new Date(client.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="rounded-xl"
          >
            <Download className="w-4 h-4 mr-2" />
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </Button>
          {canEdit && (
            <Button onClick={() => setEditDialogOpen(true)} className="rounded-xl">
              <Edit className="w-4 h-4 mr-2" />
              Edit Client
            </Button>
          )}
          {(canEdit || canManage) && client.status === 'ONBOARDING' && (
            <Button onClick={() => router.push(`/clients/${clientId}/onboarding`)} className="rounded-xl">
              <Edit className="w-4 h-4 mr-2" />
              Continue Onboarding
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingTasks}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Doctors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.doctorsCount}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.servicesCount}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">KPI Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.kpisCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="doctors">Doctors</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="targeting">Targeting</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Type</p>
                  <p className="font-medium">{client.type || 'N/A'}</p>
                </div>
                {client.primaryContactName && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Primary Contact</p>
                    <p className="font-medium">{client.primaryContactName}</p>
                  </div>
                )}
                {client.phonePrimary && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Phone
                    </p>
                    <p className="font-medium">{client.phonePrimary}</p>
                  </div>
                )}
                {client.phoneWhatsApp && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      WhatsApp
                    </p>
                    <p className="font-medium">{client.phoneWhatsApp}</p>
                  </div>
                )}
                {client.email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email
                    </p>
                    <p className="font-medium break-all">{client.email}</p>
                  </div>
                )}
                {client.preferredLanguage && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Preferred Language
                    </p>
                    <p className="font-medium">{client.preferredLanguage}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Location & Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.location && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Location</p>
                    <p className="font-medium">{client.location}</p>
                  </div>
                )}
                {client.addressLine && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="font-medium">
                      {client.addressLine}
                      {client.area && `, ${client.area}`}
                      {client.city && `, ${client.city}`}
                      {client.pincode && ` - ${client.pincode}`}
                    </p>
                  </div>
                )}
                {client.googleMapLink && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Google Maps</p>
                    <a
                      href={client.googleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Globe className="w-4 h-4" />
                      View on Google Maps
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Working Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {workingDays && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Working Days</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(workingDays).map(([day, isWorking]: [string, any]) => (
                        <Badge key={day} variant={isWorking ? 'default' : 'outline'} className="text-xs">
                          {day.substring(0, 3)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {client.workingTimings && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Working Hours</p>
                    <p className="font-medium">{client.workingTimings}</p>
                  </div>
                )}
                {client.startDate && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Start Date
                    </p>
                    <p className="font-medium">{new Date(client.startDate).toLocaleDateString()}</p>
                  </div>
                )}
                {client.onboardingCompletedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Onboarding Completed
                    </p>
                    <p className="font-medium">{new Date(client.onboardingCompletedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {client.createdAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created At
                    </p>
                    <p className="font-medium">{new Date(client.createdAt).toLocaleDateString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {client.User && (
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Account Manager
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium text-lg mb-1">{client.User.name}</p>
                  <p className="text-sm text-muted-foreground">{client.User.email}</p>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Status & Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Status</p>
                  {getStatusBadge(client.status || 'ONBOARDING')}
                </div>
                <div className="flex items-center gap-2">
                  {client.scopeFinalised ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">Scope Finalised</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium">Scope Not Finalised</span>
                    </>
                  )}
                </div>
                {client.onboardingCompletedAt ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Onboarding Completed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium">Onboarding In Progress</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Photos Preview in Overview */}
          {client.assets && client.assets.length > 0 && (
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Photos & Assets ({client.assets.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {client.assets.map((asset: any) => {
                    const imageUrl = typeof asset.url === 'string' ? asset.url : ''
                    const isImage = asset.mimeType?.startsWith('image/') || 
                      ['LOGO', 'PHOTO'].includes(asset.type) ||
                      /\.(jpg|jpeg|png|gif|webp)$/i.test(asset.url || '')
                    
                    return (
                      <div key={asset.id} className="border rounded-lg overflow-hidden group">
                        {/* Thumbnail */}
                        {isImage && imageUrl ? (
                          <div className="relative aspect-square bg-muted">
                            <img
                              src={imageUrl}
                              alt={asset.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                            {/* Download overlay on hover */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button asChild variant="secondary" size="sm">
                                <a 
                                  href={imageUrl} 
                                  download={asset.title || 'asset'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </a>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-square bg-muted flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">{asset.type}</span>
                          </div>
                        )}
                        
                        {/* Title */}
                        <div className="p-2">
                          <p className="text-xs font-medium truncate" title={asset.title}>{asset.title}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="doctors" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Doctors ({doctors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {doctors.length === 0 ? (
                <p className="text-muted-foreground">No doctors added</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Qualification</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Experience</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.map((doctor: any) => (
                      <TableRow key={doctor.id}>
                        <TableCell className="font-medium">{doctor.fullName}</TableCell>
                        <TableCell>{doctor.qualification || '-'}</TableCell>
                        <TableCell>{doctor.specialization || '-'}</TableCell>
                        <TableCell>{doctor.experienceYears ? `${doctor.experienceYears} years` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Services ({services.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <p className="text-muted-foreground">No services added</p>
              ) : (
                <div className="space-y-2">
                  {services.map((service: any) => (
                    <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.isPriority && <Badge variant="secondary" className="mt-1">Priority</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {client.usps && client.usps.length > 0 && (
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Unique Selling Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {client.usps.map((usp: any) => (
                    <p key={usp.id} className="p-2 border rounded-lg">{usp.uspText}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.branding ? (
                <>
                  {client.branding.brandColors && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Brand Colors</p>
                      <div className="flex gap-4">
                        {client.branding.brandColors.primary && (
                          <div>
                            <div
                              className="w-16 h-16 rounded border"
                              style={{ backgroundColor: client.branding.brandColors.primary }}
                            />
                            <p className="text-xs mt-1">Primary</p>
                          </div>
                        )}
                        {client.branding.brandColors.secondary && (
                          <div>
                            <div
                              className="w-16 h-16 rounded border"
                              style={{ backgroundColor: client.branding.brandColors.secondary }}
                            />
                            <p className="text-xs mt-1">Secondary</p>
                          </div>
                        )}
                        {client.branding.brandColors.accent && (
                          <div>
                            <div
                              className="w-16 h-16 rounded border"
                              style={{ backgroundColor: client.branding.brandColors.accent }}
                            />
                            <p className="text-xs mt-1">Accent</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {client.branding.designerName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Designer</p>
                      <p className="font-medium">{client.branding.designerName}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={client.branding.templateBaseCreated}
                      disabled
                      className="w-4 h-4"
                    />
                    <label>Template base created</label>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No branding information</p>
              )}
            </CardContent>
          </Card>

          {client.assets && client.assets.length > 0 && (
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Assets ({client.assets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {client.assets.map((asset: any) => {
                    // asset.url should already be a usable URL from the API
                    const imageUrl = typeof asset.url === 'string' ? asset.url : ''
                    const isImage = asset.mimeType?.startsWith('image/') || 
                      ['LOGO', 'PHOTO'].includes(asset.type) ||
                      /\.(jpg|jpeg|png|gif|webp)$/i.test(asset.url || '')
                    
                    return (
                      <div key={asset.id} className="border rounded-lg p-2 space-y-2">
                        {/* Thumbnail */}
                        {isImage && imageUrl && (
                          <div className="relative aspect-video bg-muted rounded overflow-hidden">
                            <img
                              src={imageUrl}
                              alt={asset.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Info and Download */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate" title={asset.title}>{asset.title}</p>
                            <p className="text-xs text-muted-foreground">{asset.type}</p>
                          </div>
                          {imageUrl && (
                            <Button asChild variant="outline" size="icon" className="shrink-0 h-8 w-8" title="Download">
                              <a 
                                href={imageUrl} 
                                download={asset.title || 'asset'}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Access Credentials ({client.accesses?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!client.accesses || client.accesses.length === 0 ? (
                <p className="text-muted-foreground">No access credentials added</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.accesses.map((access: any) => (
                      <TableRow key={access.id}>
                        <TableCell>{access.type}</TableCell>
                        <TableCell>{access.username || '-'}</TableCell>
                        <TableCell>
                          {(canEdit || canManage) ? (
                            <div className="flex items-center gap-2">
                              {revealedPasswords[access.id] ? (
                                <span className="font-mono text-sm">
                                  {(access as any).decryptedPassword || '••••••••'}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">••••••••</span>
                              )}
                              {access.passwordEncrypted && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRevealPassword(access.id)}
                                >
                                  {revealedPasswords[access.id] ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              {access.passwordEncrypted ? 'Has access saved' : '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {access.loginUrl && (
                            <a
                              href={access.loginUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Open
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targeting" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Targeting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.targeting ? (
                <>
                  {client.targeting.primaryLocation && (
                    <div>
                      <p className="text-sm text-muted-foreground">Primary Location</p>
                      <p className="font-medium">{client.targeting.primaryLocation}</p>
                    </div>
                  )}
                  {client.targeting.nearbyAreas && Array.isArray(client.targeting.nearbyAreas) && client.targeting.nearbyAreas.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Nearby Areas</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {client.targeting.nearbyAreas.map((area: string, idx: number) => (
                          <Badge key={idx} variant="secondary">{area}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {client.targeting.mainKeywords && Array.isArray(client.targeting.mainKeywords) && client.targeting.mainKeywords.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Main Keywords</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {client.targeting.mainKeywords.map((keyword: string, idx: number) => (
                          <Badge key={idx}>{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No targeting information</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Competitors ({client.competitors?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!client.competitors || client.competitors.length === 0 ? (
                <p className="text-muted-foreground">No competitors added</p>
              ) : (
                <div className="space-y-2">
                  {client.competitors.map((competitor: any) => (
                    <div key={competitor.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="font-medium">{competitor.name}</span>
                      {competitor.googleMapLink && (
                        <a
                          href={competitor.googleMapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View on Map
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Marketing Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              {client.marketingRequirements ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {client.marketingRequirements.gmbOptimisation && (
                      <Badge variant="secondary">GMB Optimization</Badge>
                    )}
                    {client.marketingRequirements.websiteSeo && (
                      <Badge variant="secondary">Website SEO</Badge>
                    )}
                    {client.marketingRequirements.googleAds && (
                      <Badge variant="secondary">Google Ads</Badge>
                    )}
                    {client.marketingRequirements.metaAds && (
                      <Badge variant="secondary">Meta Ads</Badge>
                    )}
                    {client.marketingRequirements.reviewManagement && (
                      <Badge variant="secondary">Review Management</Badge>
                    )}
                    {client.marketingRequirements.posters && (
                      <Badge variant="secondary">Posters</Badge>
                    )}
                    {client.marketingRequirements.videos && (
                      <Badge variant="secondary">Videos</Badge>
                    )}
                  </div>
                  {(client.marketingRequirements.socialPostsPerWeek > 0 ||
                    client.marketingRequirements.socialPostsPerMonth > 0 ||
                    client.marketingRequirements.reelsPerMonth > 0) && (
                    <div className="space-y-2">
                      {client.marketingRequirements.socialPostsPerWeek > 0 && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Social Posts per Week:</span>{' '}
                          <span className="font-medium">{client.marketingRequirements.socialPostsPerWeek}</span>
                        </p>
                      )}
                      {client.marketingRequirements.socialPostsPerMonth > 0 && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Social Posts per Month:</span>{' '}
                          <span className="font-medium">{client.marketingRequirements.socialPostsPerMonth}</span>
                        </p>
                      )}
                      {client.marketingRequirements.reelsPerMonth > 0 && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Reels per Month:</span>{' '}
                          <span className="font-medium">{client.marketingRequirements.reelsPerMonth}</span>
                        </p>
                      )}
                    </div>
                  )}
                  {client.marketingRequirements.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Notes</p>
                      <p className="text-sm">{client.marketingRequirements.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No marketing requirements set</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Approval Settings</CardTitle>
            </CardHeader>
            <CardContent>
              {client.approvalSettings ? (
                <div className="space-y-4">
                  {client.approvalSettings.pointOfContactName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Point of Contact</p>
                      <p className="font-medium">{client.approvalSettings.pointOfContactName}</p>
                    </div>
                  )}
                  {client.approvalSettings.approvalTimeHours && (
                    <div>
                      <p className="text-sm text-muted-foreground">Approval Time</p>
                      <p className="font-medium">{client.approvalSettings.approvalTimeHours} hours</p>
                    </div>
                  )}
                  {client.approvalSettings.approvalMode && (
                    <div>
                      <p className="text-sm text-muted-foreground">Approval Mode</p>
                      <p className="font-medium">{client.approvalSettings.approvalMode}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Performance Tracking</p>
                    <p className="font-medium">{client.approvalSettings.performanceTrackingMode || 'MANUAL'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No approval settings configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>KPIs</CardTitle>
            </CardHeader>
            <CardContent>
              {kpis.length === 0 ? (
                <p className="text-muted-foreground">No KPI data</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>GMB Calls</TableHead>
                      <TableHead>Direction Requests</TableHead>
                      <TableHead>Website Clicks</TableHead>
                      <TableHead>Leads Generated</TableHead>
                      <TableHead>Report Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpis.map((kpi: any) => (
                      <TableRow key={kpi.id}>
                        <TableCell className="font-medium">{kpi.month}</TableCell>
                        <TableCell>{kpi.gmbCalls}</TableCell>
                        <TableCell>{kpi.directionRequests}</TableCell>
                        <TableCell>{kpi.websiteClicks}</TableCell>
                        <TableCell>{kpi.leadsGenerated}</TableCell>
                        <TableCell>
                          <Badge variant={kpi.reportStatus === 'DONE' ? 'default' : 'secondary'}>
                            {kpi.reportStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card className="rounded-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Client Tasks</CardTitle>
                {canManage && (
                  <div className="flex gap-2">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-3 py-1 border rounded"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleGenerateTasks(selectedMonth)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Tasks
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!client.clientTasks || client.clientTasks.length === 0 ? (
                <p className="text-muted-foreground">No tasks generated yet</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(
                    client.clientTasks.reduce((acc: any, task: any) => {
                      if (!acc[task.month]) acc[task.month] = []
                      acc[task.month].push(task)
                      return acc
                    }, {})
                  ).map(([month, tasks]: [string, any]) => (
                    <div key={month}>
                      <h3 className="font-medium mb-2">{month}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Due Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(tasks as any[]).map((task: any) => (
                            <TableRow key={task.id}>
                              <TableCell className="font-medium">{task.title}</TableCell>
                              <TableCell>{task.assignedTo?.name || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={task.status === 'Approved' ? 'default' : 'secondary'}>
                                  {task.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canEdit && (
        <EditClientDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          client={client}
          onSuccess={() => {
            fetchClient()
            setEditDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}

