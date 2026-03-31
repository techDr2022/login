'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

interface Step1BasicInfoProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onSave?: (data: any) => Promise<void>
  onFinalize?: never
  loading: boolean
}

export function Step1BasicInfo({ clientId, data, onComplete, onSave, loading }: Step1BasicInfoProps) {
  const [formData, setFormData] = useState({
    name: data.basicInfo?.name || '',
    type: data.basicInfo?.type || 'CLINIC',
    primaryContactName: data.basicInfo?.primaryContactName || '',
    phonePrimary: data.basicInfo?.phonePrimary || '',
    phoneWhatsApp: data.basicInfo?.phoneWhatsApp || '',
    email: data.basicInfo?.email || '',
    addressLine: data.basicInfo?.addressLine || '',
    area: data.basicInfo?.area || '',
    city: data.basicInfo?.city || '',
    pincode: data.basicInfo?.pincode || '',
    googleMapLink: data.basicInfo?.googleMapLink || '',
    workingTimings: data.basicInfo?.workingTimings || '',
    preferredLanguage: data.basicInfo?.preferredLanguage || 'ENGLISH',
    workingDays: data.basicInfo?.workingDays || [1, 2, 3, 4, 5],
  })

  const days = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ]

  const handleDayToggle = (day: number) => {
    setFormData({
      ...formData,
      workingDays: formData.workingDays.includes(day)
        ? formData.workingDays.filter((d: number) => d !== day)
        : [...formData.workingDays, day],
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      return
    }
    // Save and then move to next step
    if (onSave) {
      try {
        await onSave(formData)
      } catch (err) {
        return // Error handling is done in parent
      }
    }
    onComplete(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Client Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter client name"
          />
        </div>
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(value: any) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger id="type">
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
          <Label htmlFor="primaryContactName">Primary Contact Name</Label>
          <Input
            id="primaryContactName"
            value={formData.primaryContactName}
            onChange={(e) => setFormData({ ...formData, primaryContactName: e.target.value })}
            placeholder="Contact person name"
          />
        </div>
        <div>
          <Label htmlFor="phonePrimary">Primary Phone</Label>
          <Input
            id="phonePrimary"
            value={formData.phonePrimary}
            onChange={(e) => setFormData({ ...formData, phonePrimary: e.target.value })}
            placeholder="+91 1234567890"
          />
        </div>
        <div>
          <Label htmlFor="phoneWhatsApp">WhatsApp Number</Label>
          <Input
            id="phoneWhatsApp"
            value={formData.phoneWhatsApp}
            onChange={(e) => setFormData({ ...formData, phoneWhatsApp: e.target.value })}
            placeholder="+91 1234567890"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="client@example.com"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="addressLine">Address Line</Label>
          <Input
            id="addressLine"
            value={formData.addressLine}
            onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
            placeholder="Street address"
          />
        </div>
        <div>
          <Label htmlFor="area">Area</Label>
          <Input
            id="area"
            value={formData.area}
            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            placeholder="Area/Locality"
          />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="City"
          />
        </div>
        <div>
          <Label htmlFor="pincode">Pincode</Label>
          <Input
            id="pincode"
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            placeholder="123456"
          />
        </div>
        <div>
          <Label htmlFor="preferredLanguage">Preferred Language</Label>
          <Select
            value={formData.preferredLanguage}
            onValueChange={(value: any) => setFormData({ ...formData, preferredLanguage: value })}
          >
            <SelectTrigger id="preferredLanguage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ENGLISH">English</SelectItem>
              <SelectItem value="TELUGU">Telugu</SelectItem>
              <SelectItem value="BOTH">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="googleMapLink">Google Map Link</Label>
          <Input
            id="googleMapLink"
            value={formData.googleMapLink}
            onChange={(e) => setFormData({ ...formData, googleMapLink: e.target.value })}
            placeholder="https://maps.google.com/..."
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="workingTimings">Working Timings</Label>
          <Input
            id="workingTimings"
            value={formData.workingTimings}
            onChange={(e) => setFormData({ ...formData, workingTimings: e.target.value })}
            placeholder="9:00 AM - 6:00 PM"
          />
        </div>
        <div className="md:col-span-2">
          <Label>Working Days</Label>
          <div className="flex flex-wrap gap-3 mt-2">
            {days.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${day.value}`}
                  checked={formData.workingDays.includes(day.value)}
                  onCheckedChange={() => handleDayToggle(day.value)}
                />
                <Label
                  htmlFor={`day-${day.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={loading || !formData.name.trim()}>
          {loading ? 'Saving...' : 'Save and Next'}
        </Button>
      </div>
    </form>
  )
}

