'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Upload, X, Image as ImageIcon } from 'lucide-react'
import { createClientDoctor, deleteClientDoctor } from '@/app/actions/client-onboarding-actions'

interface Step2DoctorsProps {
  clientId: string | null
  data: any
  onComplete: (data: any) => void
  onSave?: (data: any) => Promise<void>
  onFinalize?: never
  loading: boolean
}

export function Step2Doctors({ clientId, data, onComplete, onSave, loading }: Step2DoctorsProps) {
  const [doctors, setDoctors] = useState<any[]>(data.doctors || [])
  const [formData, setFormData] = useState({
    fullName: '',
    qualification: '',
    specialization: '',
    experienceYears: '',
    registrationNumber: '',
    languagesSpoken: [] as string[],
    photoAssetId: null as string | null,
  })
  const [doctorPhoto, setDoctorPhoto] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('clientId', clientId)
      uploadFormData.append('type', 'PHOTO')
      uploadFormData.append('category', 'CONSULTATION')
      uploadFormData.append('title', `Doctor Photo - ${formData.fullName || 'New'}`)

      const res = await fetch('/api/clients/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      const data = await res.json()

      if (res.ok) {
        setDoctorPhoto(data)
        setFormData({ ...formData, photoAssetId: data.id })
        console.log('Photo uploaded successfully:', data)
      } else {
        console.error('Upload failed:', data)
        alert(data.error || 'Failed to upload photo. Please check the console for details.')
      }
    } catch (err: any) {
      console.error('Failed to upload photo:', err)
      alert(`Failed to upload photo: ${err.message || 'Unknown error'}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handlePhotoDelete = () => {
    setDoctorPhoto(null)
    setFormData({ ...formData, photoAssetId: null })
  }

  const handleAddDoctor = async () => {
    if (!formData.fullName.trim() || !clientId) return

    try {
      const doctor = await createClientDoctor(clientId, {
        fullName: formData.fullName,
        qualification: formData.qualification || undefined,
        specialization: formData.specialization || undefined,
        experienceYears: formData.experienceYears ? parseInt(formData.experienceYears) : undefined,
        registrationNumber: formData.registrationNumber || undefined,
        languagesSpoken: formData.languagesSpoken.length > 0 ? formData.languagesSpoken : undefined,
        photoAssetId: formData.photoAssetId || undefined,
      })

      setDoctors([...doctors, doctor])
      setFormData({
        fullName: '',
        qualification: '',
        specialization: '',
        experienceYears: '',
        registrationNumber: '',
        languagesSpoken: [],
        photoAssetId: null,
      })
      setDoctorPhoto(null)
    } catch (err: any) {
      console.error('Failed to add doctor:', err)
    }
  }

  const handleRemoveDoctor = async (id: string) => {
    try {
      await deleteClientDoctor(id)
      setDoctors(doctors.filter(d => d.id !== id))
    } catch (err: any) {
      console.error('Failed to remove doctor:', err)
    }
  }

  const handleNext = async () => {
    // Save and then move to next step
    if (onSave) {
      try {
        await onSave({ doctors })
      } catch (err) {
        return // Error handling is done in parent
      }
    }
    onComplete({ doctors })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Dr. John Doe"
            />
          </div>
          <div>
            <Label htmlFor="qualification">Qualification</Label>
            <Input
              id="qualification"
              value={formData.qualification}
              onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
              placeholder="MBBS, MD, etc."
            />
          </div>
          <div>
            <Label htmlFor="specialization">Specialization</Label>
            <Input
              id="specialization"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="Cardiology, Orthopedics, etc."
            />
          </div>
          <div>
            <Label htmlFor="experienceYears">Experience (Years)</Label>
            <Input
              id="experienceYears"
              type="number"
              value={formData.experienceYears}
              onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
              placeholder="10"
            />
          </div>
          <div>
            <Label htmlFor="registrationNumber">Registration Number</Label>
            <Input
              id="registrationNumber"
              value={formData.registrationNumber}
              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
              placeholder="Registration number"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Doctor Photo</Label>
            <div className="mt-2">
              {doctorPhoto ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {doctorPhoto.url && (
                          <img
                            src={doctorPhoto.url}
                            alt="Doctor photo"
                            className="w-20 h-20 object-cover border rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium text-sm">{doctorPhoto.title}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handlePhotoDelete}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
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
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="w-6 h-6 mx-auto mb-2 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <ImageIcon className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Click to upload photo'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 10MB
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
        <Button type="button" onClick={handleAddDoctor} disabled={!formData.fullName.trim() || uploading}>
          <Plus className="w-4 h-4 mr-2" />
          Add Doctor
        </Button>
      </div>

      {doctors.length > 0 && (
        <div className="space-y-2">
          <Label>Added Doctors</Label>
          {doctors.map((doctor) => (
            <Card key={doctor.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{doctor.fullName}</p>
                    {doctor.qualification && <p className="text-sm text-muted-foreground">{doctor.qualification}</p>}
                    {doctor.specialization && <p className="text-sm text-muted-foreground">{doctor.specialization}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveDoctor(doctor.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={handleNext} disabled={loading}>
          {loading ? 'Saving...' : 'Save and Next'}
        </Button>
      </div>
    </div>
  )
}

