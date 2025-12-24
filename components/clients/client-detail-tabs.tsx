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
import { ArrowLeft, Edit, Plus, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { getClientAccessWithPassword } from '@/app/actions/client-onboarding-actions'
import { decrypt } from '@/lib/encryption'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { canManageClients } from '@/lib/rbac'
import { generateTasksForMonth } from '@/app/actions/client-onboarding-actions'

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

  const canManage = session?.user.role && canManageClients(session.user.role as UserRole)

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
      setClient(data)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{client.name || client.doctorOrHospitalName || 'Unnamed Client'}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(client.status || 'ONBOARDING')}
              {client.type && <Badge variant="outline">{client.type}</Badge>}
            </div>
          </div>
        </div>
        {canManage && client.status === 'ONBOARDING' && (
          <Button onClick={() => router.push(`/clients/${clientId}/onboarding`)}>
            <Edit className="w-4 h-4 mr-2" />
            Continue Onboarding
          </Button>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{client.type || 'N/A'}</p>
                </div>
                {client.primaryContactName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Primary Contact</p>
                    <p className="font-medium">{client.primaryContactName}</p>
                  </div>
                )}
                {client.phonePrimary && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{client.phonePrimary}</p>
                  </div>
                )}
                {client.email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{client.email}</p>
                  </div>
                )}
                {client.addressLine && (
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
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
                    <p className="text-sm text-muted-foreground">Map</p>
                    <a
                      href={client.googleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View on Google Maps
                    </a>
                  </div>
                )}
                {client.workingTimings && (
                  <div>
                    <p className="text-sm text-muted-foreground">Working Hours</p>
                    <p className="font-medium">{client.workingTimings}</p>
                  </div>
                )}
                {client.startDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{new Date(client.startDate).toLocaleDateString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {client.User && (
              <Card>
                <CardHeader>
                  <CardTitle>Account Manager</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{client.User.name}</p>
                  <p className="text-sm text-muted-foreground">{client.User.email}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="doctors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Doctors ({client.doctors?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!client.doctors || client.doctors.length === 0 ? (
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
                    {client.doctors.map((doctor: any) => (
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
          <Card>
            <CardHeader>
              <CardTitle>Services ({client.clientServices?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!client.clientServices || client.clientServices.length === 0 ? (
                <p className="text-muted-foreground">No services added</p>
              ) : (
                <div className="space-y-2">
                  {client.clientServices.map((service: any) => (
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
            <Card>
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
          <Card>
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
            <Card>
              <CardHeader>
                <CardTitle>Assets ({client.assets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {client.assets.map((asset: any) => (
                    <div key={asset.id} className="border rounded-lg p-2">
                      <p className="text-sm font-medium">{asset.title}</p>
                      <p className="text-xs text-muted-foreground">{asset.type}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
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
                          {canManage ? (
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
          <Card>
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
          <Card>
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
          <Card>
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
          <Card>
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
          <Card>
            <CardHeader>
              <CardTitle>KPIs</CardTitle>
            </CardHeader>
            <CardContent>
              {!client.kpis || client.kpis.length === 0 ? (
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
                    {client.kpis.map((kpi: any) => (
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
          <Card>
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
    </div>
  )
}

