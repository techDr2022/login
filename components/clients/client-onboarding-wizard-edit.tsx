'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, ArrowLeft } from 'lucide-react'
import { Step1BasicInfo } from './onboarding-steps/step1-basic-info'
import { Step2Doctors } from './onboarding-steps/step2-doctors'
import { Step3Services } from './onboarding-steps/step3-services'
import { Step4Branding } from './onboarding-steps/step4-branding'
import { Step5Access } from './onboarding-steps/step5-access'
import { Step6Targeting } from './onboarding-steps/step6-targeting'
import { Step7Competitors } from './onboarding-steps/step7-competitors'
import { Step8Marketing } from './onboarding-steps/step8-marketing'
import { Step9Approvals } from './onboarding-steps/step9-approvals'
import { Step10KPIs } from './onboarding-steps/step10-kpis'
import { Step11Confirmation } from './onboarding-steps/step11-confirmation'

type StepComponent = React.ComponentType<any>
type Step = { id: number; title: string; component: StepComponent }

const STEPS: Step[] = [
  { id: 1, title: 'Basic Info', component: Step1BasicInfo },
  { id: 2, title: 'Doctors', component: Step2Doctors },
  { id: 3, title: 'Services', component: Step3Services },
  { id: 4, title: 'Branding', component: Step4Branding },
  { id: 5, title: 'Access', component: Step5Access },
  { id: 6, title: 'Targeting', component: Step6Targeting },
  { id: 7, title: 'Competitors', component: Step7Competitors },
  { id: 8, title: 'Marketing', component: Step8Marketing },
  { id: 9, title: 'Approvals', component: Step9Approvals },
  { id: 10, title: 'KPIs', component: Step10KPIs },
  { id: 11, title: 'Confirmation', component: Step11Confirmation },
]

interface ClientOnboardingWizardProps {
  clientId: string
}

export function ClientOnboardingWizard({ clientId }: ClientOnboardingWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchClientData()
  }, [clientId])

  const fetchClientData = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`)
      const client = await res.json()
      
      setData({
        basicInfo: {
          name: client.name,
          type: client.type,
          primaryContactName: client.primaryContactName,
          phonePrimary: client.phonePrimary,
          phoneWhatsApp: client.phoneWhatsApp,
          email: client.email,
          addressLine: client.addressLine,
          area: client.area,
          city: client.city,
          pincode: client.pincode,
          googleMapLink: client.googleMapLink,
          workingDays: client.workingDays as number[],
          workingTimings: client.workingTimings,
          preferredLanguage: client.preferredLanguage,
        },
        doctors: client.doctors || [],
        services: client.clientServices || [],
        usps: client.usps || [],
        branding: client.branding,
        accesses: client.accesses || [],
        targeting: client.targeting,
        competitors: client.competitors || [],
        marketing: client.marketingRequirements,
        approvals: client.approvalSettings,
        kpis: client.kpis || [],
        startDate: client.startDate,
      })
    } catch (err) {
      console.error('Failed to fetch client data:', err)
    }
  }

  const handleStepComplete = async (stepData: any) => {
    setLoading(true)
    setError('')

    try {
      setData({ ...data, ...stepData })
      if (currentStep < STEPS.length) {
        setCurrentStep(currentStep + 1)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save step')
    } finally {
      setLoading(false)
    }
  }

  const handleFinalize = async (startDate: Date) => {
    setLoading(true)
    setError('')

    try {
      const { finalizeClientOnboarding } = await import('@/app/actions/client-onboarding-actions')
      await finalizeClientOnboarding(clientId, startDate)
      router.push(`/clients/${clientId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to finalize onboarding')
      setLoading(false)
    }
  }

  const calculateProgress = () => {
    let completed = 0
    if (data.basicInfo) completed++
    if (data.doctors && data.doctors.length > 0) completed++
    if (data.services && data.services.length > 0) completed++
    if (data.branding) completed++
    if (data.accesses && data.accesses.length > 0) completed++
    if (data.targeting) completed++
    if (data.competitors && data.competitors.length > 0) completed++
    if (data.marketing) completed++
    if (data.approvals) completed++
    if (data.kpis && data.kpis.length > 0) completed++
    return Math.round((completed / 10) * 100)
  }

  const CurrentStepComponent = STEPS.find(s => s.id === currentStep)?.component

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Edit Client Onboarding</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Completion</span>
                  <span className="text-sm text-muted-foreground">{calculateProgress()}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${calculateProgress()}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {STEPS.map((step) => {
                  const isActive = step.id === currentStep
                  const isCompleted = step.id < currentStep
                  const hasData = step.id === 1 ? !!data.basicInfo :
                                 step.id === 2 ? !!(data.doctors && data.doctors.length > 0) :
                                 step.id === 3 ? !!(data.services && data.services.length > 0) :
                                 step.id === 4 ? !!data.branding :
                                 step.id === 5 ? !!(data.accesses && data.accesses.length > 0) :
                                 step.id === 6 ? !!data.targeting :
                                 step.id === 7 ? !!(data.competitors && data.competitors.length > 0) :
                                 step.id === 8 ? !!data.marketing :
                                 step.id === 9 ? !!data.approvals :
                                 step.id === 10 ? !!(data.kpis && data.kpis.length > 0) :
                                 false

                  return (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isCompleted || hasData
                          ? 'bg-muted hover:bg-muted/80'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="w-4 h-4 flex items-center justify-center text-xs font-medium">
                            {step.id}
                          </span>
                        )}
                        <span className="text-sm font-medium">{step.title}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Step {currentStep}: {STEPS.find(s => s.id === currentStep)?.title}</CardTitle>
                <Badge variant="outline">
                  {currentStep} of {STEPS.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {CurrentStepComponent && (
                <CurrentStepComponent
                  clientId={clientId}
                  data={data}
                  onComplete={handleStepComplete}
                  onFinalize={currentStep === 11 ? handleFinalize : undefined}
                  loading={loading}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

