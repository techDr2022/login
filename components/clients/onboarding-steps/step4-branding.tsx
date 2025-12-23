'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { upsertClientBranding } from '@/app/actions/client-onboarding-actions'

interface Step4BrandingProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onFinalize?: never
  loading: boolean
}

export function Step4Branding({ clientId, data, onComplete, loading }: Step4BrandingProps) {
  const [brandColors, setBrandColors] = useState({
    primary: data.branding?.brandColors?.primary || '',
    secondary: data.branding?.brandColors?.secondary || '',
    accent: data.branding?.brandColors?.accent || '',
  })
  const [designerName, setDesignerName] = useState(data.branding?.designerName || '')
  const [templateBaseCreated, setTemplateBaseCreated] = useState(data.branding?.templateBaseCreated || false)
  const [logo, setLogo] = useState<any>(data.assets?.find((a: any) => a.type === 'LOGO') || null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      alert('Please select a file')
      return
    }

    if (!clientId) {
      alert('Warning: Client not created yet. Please complete Step 1 first, or the upload will fail.')
      // Continue anyway - let the API handle the error
    }

    setUploading(true)
    try {
      if (!clientId) {
        throw new Error('Client ID is required. Please complete Step 1 (Basic Info) first.')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('type', 'LOGO')
      formData.append('title', 'Logo')

      const res = await fetch('/api/clients/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setLogo(data)
        console.log('Logo uploaded successfully:', data)
      } else {
        console.error('Upload failed:', data)
        alert(data.error || 'Failed to upload logo. Please check the console for details.')
      }
    } catch (err: any) {
      console.error('Failed to upload logo:', err)
      alert(`Failed to upload logo: ${err.message || 'Unknown error'}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleLogoDelete = async () => {
    if (!logo?.id) return
    if (!confirm('Are you sure you want to delete the logo?')) return

    try {
      const res = await fetch(`/api/clients/upload?assetId=${logo.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setLogo(null)
      } else {
        alert('Failed to delete logo')
      }
    } catch (err) {
      console.error('Failed to delete logo:', err)
      alert('Failed to delete logo')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return

    try {
      await upsertClientBranding(clientId, {
        brandColors: Object.values(brandColors).some(v => v) ? brandColors : undefined,
        designerName: designerName || undefined,
        templateBaseCreated,
      })
      onComplete({ branding: { brandColors, designerName, templateBaseCreated }, assets: logo ? [logo] : [] })
    } catch (err: any) {
      console.error('Failed to save branding:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label>Logo</Label>
          <div className="mt-2">
            {logo ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {logo.url && (
                        <img
                          src={logo.url}
                          alt="Logo"
                          className="w-20 h-20 object-contain border rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{logo.title}</p>
                        <p className="text-sm text-muted-foreground">{logo.type}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleLogoDelete}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  uploading
                    ? 'border-blue-300 bg-blue-50 cursor-wait'
                    : 'border-gray-300 hover:border-primary cursor-pointer'
                }`}
                onClick={() => {
                  if (!uploading) {
                    fileInputRef.current?.click()
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="w-8 h-8 mx-auto mb-2 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  {uploading ? 'Uploading...' : 'Click to upload logo'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, SVG up to 10MB
                </p>
                {!clientId && (
                  <p className="text-xs text-yellow-600 mt-2">
                    ⚠️ Complete Step 1 first for best results
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="primaryColor">Primary Color</Label>
          <div className="flex gap-2">
            <Input
              id="primaryColor"
              type="color"
              value={brandColors.primary || '#000000'}
              onChange={(e) => setBrandColors({ ...brandColors, primary: e.target.value })}
              className="w-20 h-10"
            />
            <Input
              value={brandColors.primary}
              onChange={(e) => setBrandColors({ ...brandColors, primary: e.target.value })}
              placeholder="#000000"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="secondaryColor">Secondary Color</Label>
          <div className="flex gap-2">
            <Input
              id="secondaryColor"
              type="color"
              value={brandColors.secondary || '#000000'}
              onChange={(e) => setBrandColors({ ...brandColors, secondary: e.target.value })}
              className="w-20 h-10"
            />
            <Input
              value={brandColors.secondary}
              onChange={(e) => setBrandColors({ ...brandColors, secondary: e.target.value })}
              placeholder="#000000"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="accentColor">Accent Color</Label>
          <div className="flex gap-2">
            <Input
              id="accentColor"
              type="color"
              value={brandColors.accent || '#000000'}
              onChange={(e) => setBrandColors({ ...brandColors, accent: e.target.value })}
              className="w-20 h-10"
            />
            <Input
              value={brandColors.accent}
              onChange={(e) => setBrandColors({ ...brandColors, accent: e.target.value })}
              placeholder="#000000"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="designerName">Designer Name</Label>
        <Input
          id="designerName"
          value={designerName}
          onChange={(e) => setDesignerName(e.target.value)}
          placeholder="Designer name"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="templateBaseCreated"
          checked={templateBaseCreated}
          onChange={(e) => setTemplateBaseCreated(e.target.checked)}
          className="w-4 h-4"
        />
        <Label htmlFor="templateBaseCreated" className="cursor-pointer">
          Template base created
        </Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading}>
          Next Step
        </Button>
      </div>
    </form>
  )
}

