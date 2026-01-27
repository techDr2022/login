'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, X, Plus, Trash2, Image as ImageIcon, Globe, Facebook, Instagram, MessageCircle, Link as LinkIcon, DollarSign } from 'lucide-react'
import { DatePicker } from '@/components/ui/date-picker'
import { updateClientInvoice } from '@/app/actions/invoice-actions'
import {
  updateClientBasicInfo,
  createClientAccess,
  updateClientAccess,
  deleteClientAccess,
  upsertClientBranding,
  upsertClientTargeting,
  createClientCompetitor,
  updateClientCompetitor,
  deleteClientCompetitor,
  upsertClientMarketingRequirement,
  upsertClientApprovalSettings,
} from '@/app/actions/client-onboarding-actions'
import { useSession } from 'next-auth/react'
import { canEditClient } from '@/lib/rbac'
import { UserRole } from '@prisma/client'

interface EditClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: any
  onSuccess?: () => void
}

export function EditClientDialog({ open, onOpenChange, client, onSuccess }: EditClientDialogProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('basic')

  // Reset to basic tab if employee tries to access invoice tab
  useEffect(() => {
    if (activeTab === 'invoice' && session?.user.role !== UserRole.SUPER_ADMIN) {
      setActiveTab('basic')
    }
  }, [activeTab, session?.user.role])
  
  // Basic Info State
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    doctorOrHospitalName: '',
    location: '',
    type: 'CLINIC' as 'CLINIC' | 'HOSPITAL' | 'DOCTOR',
    primaryContactName: '',
    phonePrimary: '',
    phoneWhatsApp: '',
    email: '',
    addressLine: '',
    area: '',
    city: '',
    pincode: '',
    googleMapLink: '',
    workingTimings: '',
    preferredLanguage: 'ENGLISH' as 'TELUGU' | 'ENGLISH' | 'BOTH',
    workingDays: [] as number[],
  })

  // Social Media/Access State
  const [accesses, setAccesses] = useState<any[]>([])
  const [newAccess, setNewAccess] = useState({
    type: 'FACEBOOK' as 'GMB' | 'WEBSITE' | 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP',
    loginUrl: '',
    username: '',
    password: '',
    notes: '',
  })

  // Branding State
  const [branding, setBranding] = useState({
    brandColors: { primary: '', secondary: '', accent: '' },
    designerName: '',
    templateBaseCreated: false,
  })

  // Targeting State
  const [targeting, setTargeting] = useState({
    primaryLocation: '',
    nearbyAreas: [] as string[],
    mainKeywords: [] as string[],
  })

  // Competitors State
  const [competitors, setCompetitors] = useState<any[]>([])
  const [newCompetitor, setNewCompetitor] = useState({ name: '', googleMapLink: '' })

  // Marketing State
  const [marketing, setMarketing] = useState({
    gmbOptimisation: false,
    websiteSeo: false,
    socialPostsPerWeek: 0,
    socialPostsPerMonth: 0,
    reelsPerMonth: 0,
    googleAds: false,
    metaAds: false,
    reviewManagement: false,
    posters: false,
    videos: false,
    notes: '',
  })

  // Approval Settings State
  const [approvalSettings, setApprovalSettings] = useState({
    pointOfContactName: '',
    approvalTimeHours: undefined as number | undefined,
    approvalMode: 'WHATSAPP' as 'WHATSAPP' | 'EMAIL' | 'BOTH',
    performanceTrackingMode: 'MANUAL' as 'AUTO' | 'MANUAL',
  })

  // Assets/Photos State
  const [assets, setAssets] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Invoice State
  const [invoiceInfo, setInvoiceInfo] = useState({
    startDate: null as Date | null,
    endDate: null as Date | null,
    monthlyAmount: '' as string | number,
    planDuration: '' as string,
    nextPaymentDate: null as Date | null,
    lastPaymentDate: null as Date | null,
  })

  const canEdit = session?.user.role && canEditClient(session.user.role as UserRole)

  useEffect(() => {
    if (client && open) {
      // Load basic info
      setBasicInfo({
        name: client.name || '',
        doctorOrHospitalName: client.doctorOrHospitalName || '',
        location: client.location || '',
        type: client.type || 'CLINIC',
        primaryContactName: client.primaryContactName || '',
        phonePrimary: client.phonePrimary || '',
        phoneWhatsApp: client.phoneWhatsApp || '',
        email: client.email || '',
        addressLine: client.addressLine || '',
        area: client.area || '',
        city: client.city || '',
        pincode: client.pincode || '',
        googleMapLink: client.googleMapLink || '',
        workingTimings: client.workingTimings || '',
        preferredLanguage: client.preferredLanguage || 'ENGLISH',
        workingDays: client.workingDays ? (typeof client.workingDays === 'string' ? JSON.parse(client.workingDays) : client.workingDays) : [],
      })

      // Load accesses (social media links)
      setAccesses(client.accesses || client.client_accesses || [])

      // Load branding
      if (client.branding || client.client_branding) {
        const b = client.branding || client.client_branding
        setBranding({
          brandColors: b.brandColors ? (typeof b.brandColors === 'string' ? JSON.parse(b.brandColors) : b.brandColors) : { primary: '', secondary: '', accent: '' },
          designerName: b.designerName || '',
          templateBaseCreated: b.templateBaseCreated || false,
        })
      }

      // Load targeting
      if (client.targeting || client.client_targeting) {
        const t = client.targeting || client.client_targeting
        setTargeting({
          primaryLocation: t.primaryLocation || '',
          nearbyAreas: t.nearbyAreas ? (Array.isArray(t.nearbyAreas) ? t.nearbyAreas : JSON.parse(t.nearbyAreas)) : [],
          mainKeywords: t.mainKeywords ? (Array.isArray(t.mainKeywords) ? t.mainKeywords : JSON.parse(t.mainKeywords)) : [],
        })
      }

      // Load competitors
      setCompetitors(client.competitors || client.client_competitors || [])

      // Load marketing
      if (client.marketingRequirements || client.client_marketing_requirements) {
        const m = client.marketingRequirements || client.client_marketing_requirements
        setMarketing({
          gmbOptimisation: m.gmbOptimisation || false,
          websiteSeo: m.websiteSeo || false,
          socialPostsPerWeek: m.socialPostsPerWeek || 0,
          socialPostsPerMonth: m.socialPostsPerMonth || 0,
          reelsPerMonth: m.reelsPerMonth || 0,
          googleAds: m.googleAds || false,
          metaAds: m.metaAds || false,
          reviewManagement: m.reviewManagement || false,
          posters: m.posters || false,
          videos: m.videos || false,
          notes: m.notes || '',
        })
      }

      // Load approval settings
      if (client.approvalSettings || client.client_approval_settings) {
        const a = client.approvalSettings || client.client_approval_settings
        setApprovalSettings({
          pointOfContactName: a.pointOfContactName || '',
          approvalTimeHours: a.approvalTimeHours && a.approvalTimeHours > 0 ? a.approvalTimeHours : undefined,
          approvalMode: a.approvalMode || 'WHATSAPP',
          performanceTrackingMode: a.performanceTrackingMode || 'MANUAL',
        })
      }

      // Load assets
      setAssets(client.assets || client.client_assets || [])

      // Load invoice info
      setInvoiceInfo({
        startDate: client.startDate ? new Date(client.startDate) : null,
        endDate: client.endDate ? new Date(client.endDate) : null,
        monthlyAmount: client.monthlyAmount || '',
        planDuration: client.planDuration || '',
        nextPaymentDate: client.nextPaymentDate ? new Date(client.nextPaymentDate) : null,
        lastPaymentDate: client.lastPaymentDate ? new Date(client.lastPaymentDate) : null,
      })
    }
  }, [client, open])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !client?.id) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', client.id)
      formData.append('type', 'PHOTO')
      formData.append('title', file.name)

      const res = await fetch('/api/clients/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setAssets([...assets, data])
      } else {
        alert(data.error || 'Failed to upload file')
      }
    } catch (err: any) {
      alert(`Failed to upload file: ${err.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return

    try {
      const res = await fetch(`/api/clients/upload?assetId=${assetId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setAssets(assets.filter(a => a.id !== assetId))
      } else {
        alert('Failed to delete asset')
      }
    } catch (err) {
      alert('Failed to delete asset')
    }
  }

  const handleAddAccess = async () => {
    if (!client?.id) return

    try {
      const access = await createClientAccess(client.id, newAccess)
      setAccesses([...accesses, access])
      setNewAccess({ type: 'FACEBOOK', loginUrl: '', username: '', password: '', notes: '' })
    } catch (err: any) {
      alert(err.message || 'Failed to add access')
    }
  }

  const handleUpdateAccess = async (id: string, data: any) => {
    try {
      await updateClientAccess(id, data)
      setAccesses(accesses.map(a => a.id === id ? { ...a, ...data } : a))
    } catch (err: any) {
      alert(err.message || 'Failed to update access')
    }
  }

  const handleDeleteAccess = async (id: string) => {
    if (!confirm('Are you sure you want to delete this access?')) return

    try {
      await deleteClientAccess(id)
      setAccesses(accesses.filter(a => a.id !== id))
    } catch (err: any) {
      alert(err.message || 'Failed to delete access')
    }
  }

  const handleAddCompetitor = async () => {
    if (!client?.id || !newCompetitor.name) return

    try {
      const competitor = await createClientCompetitor(client.id, newCompetitor)
      setCompetitors([...competitors, competitor])
      setNewCompetitor({ name: '', googleMapLink: '' })
    } catch (err: any) {
      alert(err.message || 'Failed to add competitor')
    }
  }

  const handleSave = async () => {
    if (!client?.id || !canEdit) return

    setLoading(true)
    setError('')

    try {
      // Save basic info
      await updateClientBasicInfo(client.id, {
        ...basicInfo,
        workingDays: basicInfo.workingDays.length > 0 ? basicInfo.workingDays : undefined,
      })

      // Save branding
      if (branding.brandColors.primary || branding.brandColors.secondary || branding.brandColors.accent || branding.designerName) {
        await upsertClientBranding(client.id, branding)
      }

      // Save targeting
      if (targeting.primaryLocation || targeting.nearbyAreas.length > 0 || targeting.mainKeywords.length > 0) {
        await upsertClientTargeting(client.id, targeting)
      }

      // Save marketing
      await upsertClientMarketingRequirement(client.id, marketing)

      // Save approval settings
      await upsertClientApprovalSettings(client.id, {
        ...approvalSettings,
        approvalTimeHours: approvalSettings.approvalTimeHours && approvalSettings.approvalTimeHours > 0 
          ? approvalSettings.approvalTimeHours 
          : undefined,
      })

      // Save invoice info (only if user is super admin)
      if (session?.user.role === UserRole.SUPER_ADMIN) {
        await updateClientInvoice(client.id, {
          startDate: invoiceInfo.startDate,
          endDate: invoiceInfo.endDate,
          monthlyAmount: invoiceInfo.monthlyAmount ? Number(invoiceInfo.monthlyAmount) : null,
          planDuration: invoiceInfo.planDuration ? (invoiceInfo.planDuration as 'ONE_MONTH' | 'THREE_MONTHS' | 'SIX_MONTHS') : null,
          nextPaymentDate: invoiceInfo.nextPaymentDate,
          lastPaymentDate: invoiceInfo.lastPaymentDate,
        })
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to save changes')
    } finally {
      setLoading(false)
    }
  }

  if (!canEdit) {
    return null
  }

  const workingDaysOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client Details</DialogTitle>
          <DialogDescription>
            Update client information, social media links, photos, and other details.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${session?.user.role === UserRole.SUPER_ADMIN ? 'grid-cols-7' : 'grid-cols-6'}`}>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="targeting">Targeting</TabsTrigger>
            {session?.user.role === UserRole.SUPER_ADMIN && (
              <TabsTrigger value="invoice">Invoice</TabsTrigger>
            )}
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client Name *</Label>
                <Input
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Doctor/Hospital Name *</Label>
                <Input
                  value={basicInfo.doctorOrHospitalName}
                  onChange={(e) => setBasicInfo({ ...basicInfo, doctorOrHospitalName: e.target.value })}
                />
              </div>
              <div>
                <Label>Location *</Label>
                <Input
                  value={basicInfo.location}
                  onChange={(e) => setBasicInfo({ ...basicInfo, location: e.target.value })}
                />
              </div>
              <div>
                <Label>Type *</Label>
                <Select
                  value={basicInfo.type}
                  onValueChange={(value: any) => setBasicInfo({ ...basicInfo, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLINIC">Clinic</SelectItem>
                    <SelectItem value="HOSPITAL">Hospital</SelectItem>
                    <SelectItem value="DOCTOR">Doctor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Primary Contact Name</Label>
                <Input
                  value={basicInfo.primaryContactName}
                  onChange={(e) => setBasicInfo({ ...basicInfo, primaryContactName: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone Primary</Label>
                <Input
                  value={basicInfo.phonePrimary}
                  onChange={(e) => setBasicInfo({ ...basicInfo, phonePrimary: e.target.value })}
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={basicInfo.phoneWhatsApp}
                  onChange={(e) => setBasicInfo({ ...basicInfo, phoneWhatsApp: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={basicInfo.email}
                  onChange={(e) => setBasicInfo({ ...basicInfo, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Preferred Language</Label>
                <Select
                  value={basicInfo.preferredLanguage}
                  onValueChange={(value: any) => setBasicInfo({ ...basicInfo, preferredLanguage: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TELUGU">Telugu</SelectItem>
                    <SelectItem value="ENGLISH">English</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Address Line</Label>
                <Input
                  value={basicInfo.addressLine}
                  onChange={(e) => setBasicInfo({ ...basicInfo, addressLine: e.target.value })}
                />
              </div>
              <div>
                <Label>Area</Label>
                <Input
                  value={basicInfo.area}
                  onChange={(e) => setBasicInfo({ ...basicInfo, area: e.target.value })}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={basicInfo.city}
                  onChange={(e) => setBasicInfo({ ...basicInfo, city: e.target.value })}
                />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input
                  value={basicInfo.pincode}
                  onChange={(e) => setBasicInfo({ ...basicInfo, pincode: e.target.value })}
                />
              </div>
              <div>
                <Label>Google Map Link</Label>
                <Input
                  value={basicInfo.googleMapLink}
                  onChange={(e) => setBasicInfo({ ...basicInfo, googleMapLink: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>
              <div>
                <Label>Working Timings</Label>
                <Input
                  value={basicInfo.workingTimings}
                  onChange={(e) => setBasicInfo({ ...basicInfo, workingTimings: e.target.value })}
                  placeholder="9:00 AM - 6:00 PM"
                />
              </div>
            </div>
            <div>
              <Label>Working Days</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {workingDaysOptions.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={basicInfo.workingDays.includes(day.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (basicInfo.workingDays.includes(day.value)) {
                        setBasicInfo({
                          ...basicInfo,
                          workingDays: basicInfo.workingDays.filter(d => d !== day.value),
                        })
                      } else {
                        setBasicInfo({
                          ...basicInfo,
                          workingDays: [...basicInfo.workingDays, day.value],
                        })
                      }
                    }}
                  >
                    {day.label.substring(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Social Media Links & Access</h3>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddAccess}
                  disabled={!newAccess.type}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Access
                </Button>
              </div>

              {/* Add New Access Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Add New Social Media Access</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Platform</Label>
                      <Select
                        value={newAccess.type}
                        onValueChange={(value: any) => setNewAccess({ ...newAccess, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FACEBOOK">Facebook</SelectItem>
                          <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                          <SelectItem value="GMB">Google My Business</SelectItem>
                          <SelectItem value="WEBSITE">Website</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Login URL</Label>
                      <Input
                        value={newAccess.loginUrl}
                        onChange={(e) => setNewAccess({ ...newAccess, loginUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={newAccess.username}
                        onChange={(e) => setNewAccess({ ...newAccess, username: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={newAccess.password}
                        onChange={(e) => setNewAccess({ ...newAccess, password: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={newAccess.notes}
                      onChange={(e) => setNewAccess({ ...newAccess, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Existing Accesses */}
              <div className="space-y-2">
                {accesses.map((access) => (
                  <Card key={access.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge>{access.type}</Badge>
                            {access.loginUrl && (
                              <a
                                href={access.loginUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                              >
                                <LinkIcon className="w-3 h-3" />
                                Open Link
                              </a>
                            )}
                          </div>
                          {access.username && <p className="text-sm"><strong>Username:</strong> {access.username}</p>}
                          {access.notes && <p className="text-sm text-muted-foreground">{access.notes}</p>}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAccess(access.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {accesses.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No social media links added yet</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="photos" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Photos & Assets</h3>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {assets.map((asset) => (
                  <Card key={asset.id}>
                    <CardContent className="p-4">
                      {asset.url && (
                        <img
                          src={asset.url}
                          alt={asset.title}
                          className="w-full h-32 object-cover rounded mb-2"
                        />
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{asset.title}</p>
                          <p className="text-xs text-muted-foreground">{asset.type}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAsset(asset.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {assets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8 col-span-3">
                    No photos uploaded yet. Click "Upload Photo" to add photos.
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="branding" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={branding.brandColors.primary}
                    onChange={(e) => setBranding({
                      ...branding,
                      brandColors: { ...branding.brandColors, primary: e.target.value },
                    })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={branding.brandColors.primary}
                    onChange={(e) => setBranding({
                      ...branding,
                      brandColors: { ...branding.brandColors, primary: e.target.value },
                    })}
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div>
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={branding.brandColors.secondary}
                    onChange={(e) => setBranding({
                      ...branding,
                      brandColors: { ...branding.brandColors, secondary: e.target.value },
                    })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={branding.brandColors.secondary}
                    onChange={(e) => setBranding({
                      ...branding,
                      brandColors: { ...branding.brandColors, secondary: e.target.value },
                    })}
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div>
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={branding.brandColors.accent}
                    onChange={(e) => setBranding({
                      ...branding,
                      brandColors: { ...branding.brandColors, accent: e.target.value },
                    })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={branding.brandColors.accent}
                    onChange={(e) => setBranding({
                      ...branding,
                      brandColors: { ...branding.brandColors, accent: e.target.value },
                    })}
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div>
                <Label>Designer Name</Label>
                <Input
                  value={branding.designerName}
                  onChange={(e) => setBranding({ ...branding, designerName: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="targeting" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Primary Location</Label>
                <Input
                  value={targeting.primaryLocation}
                  onChange={(e) => setTargeting({ ...targeting, primaryLocation: e.target.value })}
                />
              </div>
              <div>
                <Label>Nearby Areas (comma-separated)</Label>
                <Input
                  value={targeting.nearbyAreas.join(', ')}
                  onChange={(e) => setTargeting({
                    ...targeting,
                    nearbyAreas: e.target.value.split(',').map(s => s.trim()).filter(s => s),
                  })}
                  placeholder="Area 1, Area 2, Area 3"
                />
              </div>
              <div>
                <Label>Main Keywords (comma-separated)</Label>
                <Input
                  value={targeting.mainKeywords.join(', ')}
                  onChange={(e) => setTargeting({
                    ...targeting,
                    mainKeywords: e.target.value.split(',').map(s => s.trim()).filter(s => s),
                  })}
                  placeholder="Keyword 1, Keyword 2, Keyword 3"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invoice" className="space-y-4">
            {session?.user.role === UserRole.SUPER_ADMIN ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Invoice & Payment Information
                    </CardTitle>
                    <CardDescription>
                      Manage project dates and payment schedules for this client
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Project Start Date</Label>
                        <DatePicker
                          date={invoiceInfo.startDate}
                          onSelect={(date) => setInvoiceInfo({ ...invoiceInfo, startDate: date })}
                          placeholder="Select start date"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Project End Date</Label>
                        <DatePicker
                          date={invoiceInfo.endDate}
                          onSelect={(date) => setInvoiceInfo({ ...invoiceInfo, endDate: date })}
                          placeholder="Select end date"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Monthly Amount (₹)</Label>
                        <Input
                          type="number"
                          value={invoiceInfo.monthlyAmount}
                          onChange={(e) => setInvoiceInfo({ ...invoiceInfo, monthlyAmount: e.target.value })}
                          placeholder="Enter monthly payment amount"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Plan Duration</Label>
                        <Select
                          value={invoiceInfo.planDuration}
                          onValueChange={(value) => {
                            setInvoiceInfo({ ...invoiceInfo, planDuration: value })
                            // Auto-calculate end date if start date is set
                            if (value && invoiceInfo.startDate) {
                              const startDate = new Date(invoiceInfo.startDate)
                              let monthsToAdd = 0
                              if (value === 'ONE_MONTH') monthsToAdd = 1
                              else if (value === 'THREE_MONTHS') monthsToAdd = 3
                              else if (value === 'SIX_MONTHS') monthsToAdd = 6
                              
                              const endDate = new Date(startDate)
                              endDate.setMonth(endDate.getMonth() + monthsToAdd)
                              setInvoiceInfo({ ...invoiceInfo, planDuration: value, endDate })
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select plan duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ONE_MONTH">1 Month</SelectItem>
                            <SelectItem value="THREE_MONTHS">3 Months</SelectItem>
                            <SelectItem value="SIX_MONTHS">6 Months</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          End date will be auto-calculated based on start date
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Next Payment Date</Label>
                        <DatePicker
                          date={invoiceInfo.nextPaymentDate}
                          onSelect={(date) => setInvoiceInfo({ ...invoiceInfo, nextPaymentDate: date })}
                          placeholder="Select next payment date"
                        />
                        <p className="text-xs text-muted-foreground">
                          Payment reminders will be sent 7 days before this date
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Last Payment Date</Label>
                        <DatePicker
                          date={invoiceInfo.lastPaymentDate}
                          onSelect={(date) => setInvoiceInfo({ ...invoiceInfo, lastPaymentDate: date })}
                          placeholder="Select last payment date"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Only super admins can manage invoice information
              </div>
            )}
          </TabsContent>

          <TabsContent value="other" className="space-y-4">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Marketing Requirements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={marketing.gmbOptimisation}
                        onChange={(e) => setMarketing({ ...marketing, gmbOptimisation: e.target.checked })}
                      />
                      <Label>GMB Optimization</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={marketing.websiteSeo}
                        onChange={(e) => setMarketing({ ...marketing, websiteSeo: e.target.checked })}
                      />
                      <Label>Website SEO</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={marketing.googleAds}
                        onChange={(e) => setMarketing({ ...marketing, googleAds: e.target.checked })}
                      />
                      <Label>Google Ads</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={marketing.metaAds}
                        onChange={(e) => setMarketing({ ...marketing, metaAds: e.target.checked })}
                      />
                      <Label>Meta Ads</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={marketing.reviewManagement}
                        onChange={(e) => setMarketing({ ...marketing, reviewManagement: e.target.checked })}
                      />
                      <Label>Review Management</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={marketing.posters}
                        onChange={(e) => setMarketing({ ...marketing, posters: e.target.checked })}
                      />
                      <Label>Posters</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={marketing.videos}
                        onChange={(e) => setMarketing({ ...marketing, videos: e.target.checked })}
                      />
                      <Label>Videos</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Social Posts/Week</Label>
                      <Input
                        type="number"
                        value={marketing.socialPostsPerWeek}
                        onChange={(e) => setMarketing({ ...marketing, socialPostsPerWeek: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Social Posts/Month</Label>
                      <Input
                        type="number"
                        value={marketing.socialPostsPerMonth}
                        onChange={(e) => setMarketing({ ...marketing, socialPostsPerMonth: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label>Reels/Month</Label>
                      <Input
                        type="number"
                        value={marketing.reelsPerMonth}
                        onChange={(e) => setMarketing({ ...marketing, reelsPerMonth: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={marketing.notes}
                      onChange={(e) => setMarketing({ ...marketing, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Approval Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Point of Contact Name</Label>
                    <Input
                      value={approvalSettings.pointOfContactName}
                      onChange={(e) => setApprovalSettings({ ...approvalSettings, pointOfContactName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Approval Time (Hours)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={approvalSettings.approvalTimeHours ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          setApprovalSettings({
                            ...approvalSettings,
                            approvalTimeHours: value === '' || value === '0' ? undefined : parseInt(value) || undefined,
                          })
                        }}
                      />
                    </div>
                    <div>
                      <Label>Approval Mode</Label>
                      <Select
                        value={approvalSettings.approvalMode}
                        onValueChange={(value: any) => setApprovalSettings({ ...approvalSettings, approvalMode: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Competitors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newCompetitor.name}
                      onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
                      placeholder="Competitor name"
                    />
                    <Input
                      value={newCompetitor.googleMapLink}
                      onChange={(e) => setNewCompetitor({ ...newCompetitor, googleMapLink: e.target.value })}
                      placeholder="Google Map Link"
                    />
                    <Button type="button" onClick={handleAddCompetitor}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {competitors.map((competitor) => (
                      <div key={competitor.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{competitor.name}</p>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteClientCompetitor(competitor.id).then(() => {
                            setCompetitors(competitors.filter(c => c.id !== competitor.id))
                          })}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

