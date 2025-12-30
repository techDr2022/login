export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import jsPDF from 'jspdf'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!params.id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    // Fetch complete client data
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        client_doctors: {
          orderBy: { createdAt: 'asc' },
        },
        client_services: {
          orderBy: { createdAt: 'asc' },
        },
        client_usps: {
          orderBy: { createdAt: 'asc' },
        },
        client_accesses: {
          orderBy: { type: 'asc' },
        },
        client_branding: true,
        client_targeting: true,
        client_competitors: {
          orderBy: { createdAt: 'asc' },
        },
        client_marketing_requirements: true,
        client_approval_settings: true,
        client_kpi_monthly: {
          orderBy: { month: 'desc' },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Generate PDF
    const doc = new jsPDF()
    let yPosition = 20
    const pageHeight = doc.internal.pageSize.height
    const margin = 20
    const lineHeight = 7
    const sectionSpacing = 10

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }
    }

    // Helper function to add text with word wrap
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, x: number = margin) => {
      checkPageBreak(lineHeight)
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', isBold ? 'bold' : 'normal')
      const lines = doc.splitTextToSize(text, 170)
      doc.text(lines, x, yPosition)
      yPosition += lines.length * lineHeight
    }

    // Title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Client Onboarding Report', margin, yPosition)
    yPosition += 15

    // Basic Information
    addText('1. BASIC INFORMATION', 14, true)
    yPosition += 2
    addText(`Client Name: ${client.name}`, 11)
    addText(`Type: ${client.type || 'N/A'}`, 11)
    addText(`Primary Contact: ${client.primaryContactName || 'N/A'}`, 11)
    addText(`Primary Phone: ${client.phonePrimary || 'N/A'}`, 11)
    addText(`WhatsApp: ${client.phoneWhatsApp || 'N/A'}`, 11)
    addText(`Email: ${client.email || 'N/A'}`, 11)
    addText(`Address: ${client.addressLine || 'N/A'}`, 11)
    addText(`Area: ${client.area || 'N/A'}`, 11)
    addText(`City: ${client.city || 'N/A'}`, 11)
    addText(`Pincode: ${client.pincode || 'N/A'}`, 11)
    if (client.googleMapLink) {
      addText(`Google Map Link: ${client.googleMapLink}`, 11)
    }
    addText(`Working Days: ${client.workingDays ? JSON.stringify(client.workingDays) : 'N/A'}`, 11)
    addText(`Working Timings: ${client.workingTimings || 'N/A'}`, 11)
    addText(`Preferred Language: ${client.preferredLanguage || 'N/A'}`, 11)
    if (client.User) {
      addText(`Account Manager: ${client.User.name} (${client.User.email})`, 11)
    }
    yPosition += sectionSpacing

    // Doctors
    if (client.client_doctors && client.client_doctors.length > 0) {
      addText('2. DOCTORS', 14, true)
      yPosition += 2
      client.client_doctors.forEach((doctor, index) => {
        checkPageBreak(30)
        addText(`Doctor ${index + 1}:`, 11, true)
        addText(`  Name: ${doctor.fullName}`, 10)
        addText(`  Specialization: ${doctor.specialization || 'N/A'}`, 10)
        addText(`  Qualification: ${doctor.qualification || 'N/A'}`, 10)
        addText(`  Experience: ${doctor.experienceYears || 'N/A'}`, 10)
        if (doctor.languagesSpoken) {
          const languages = Array.isArray(doctor.languagesSpoken) 
            ? doctor.languagesSpoken.join(', ') 
            : JSON.stringify(doctor.languagesSpoken)
          addText(`  Languages: ${languages}`, 10)
        }
        yPosition += 2
      })
      yPosition += sectionSpacing
    }

    // Services
    if (client.client_services && client.client_services.length > 0) {
      addText('3. SERVICES', 14, true)
      yPosition += 2
      client.client_services.forEach((service, index) => {
        checkPageBreak(20)
        addText(`Service ${index + 1}: ${service.name}`, 11)
        yPosition += 2
      })
      yPosition += sectionSpacing
    }

    // USPs
    if (client.client_usps && client.client_usps.length > 0) {
      addText('4. UNIQUE SELLING POINTS (USPs)', 14, true)
      yPosition += 2
      client.client_usps.forEach((usp, index) => {
        checkPageBreak(15)
        addText(`${index + 1}. ${usp.uspText}`, 11)
        yPosition += 2
      })
      yPosition += sectionSpacing
    }

    // Branding
    if (client.client_branding) {
      addText('5. BRANDING', 14, true)
      yPosition += 2
      const branding = client.client_branding
      if (branding.brandColors) {
        const colors = typeof branding.brandColors === 'string' 
          ? branding.brandColors 
          : JSON.stringify(branding.brandColors)
        addText(`Brand Colors: ${colors}`, 11)
      }
      addText(`Designer Name: ${branding.designerName || 'N/A'}`, 11)
      addText(`Template Base Created: ${branding.templateBaseCreated ? 'Yes' : 'No'}`, 11)
      yPosition += sectionSpacing
    }

    // Access Credentials
    if (client.client_accesses && client.client_accesses.length > 0) {
      addText('6. ACCESS CREDENTIALS', 14, true)
      yPosition += 2
      client.client_accesses.forEach((access, index) => {
        checkPageBreak(25)
        addText(`Access ${index + 1}:`, 11, true)
        addText(`  Type: ${access.type}`, 10)
        if (access.loginUrl) {
          addText(`  Login URL: ${access.loginUrl}`, 10)
        }
        if (access.username) {
          addText(`  Username: ${access.username}`, 10)
        }
        if (access.passwordEncrypted) {
          try {
            const password = decrypt(access.passwordEncrypted)
            addText(`  Password: ${password}`, 10)
          } catch (e) {
            addText(`  Password: [Encrypted]`, 10)
          }
        }
        if (access.notes) {
          addText(`  Notes: ${access.notes}`, 10)
        }
        yPosition += 2
      })
      yPosition += sectionSpacing
    }

    // Targeting
    if (client.client_targeting) {
      addText('7. TARGETING', 14, true)
      yPosition += 2
      const targeting = client.client_targeting
      addText(`Primary Location: ${targeting.primaryLocation || 'N/A'}`, 11)
      if (targeting.nearbyAreas) {
        const areas = Array.isArray(targeting.nearbyAreas)
          ? targeting.nearbyAreas.join(', ')
          : JSON.stringify(targeting.nearbyAreas)
        addText(`Nearby Areas: ${areas}`, 11)
      }
      if (targeting.mainKeywords) {
        const keywords = Array.isArray(targeting.mainKeywords)
          ? targeting.mainKeywords.join(', ')
          : JSON.stringify(targeting.mainKeywords)
        addText(`Main Keywords: ${keywords}`, 11)
      }
      if (targeting.exampleKeywords) {
        const examples = Array.isArray(targeting.exampleKeywords)
          ? targeting.exampleKeywords.join(', ')
          : JSON.stringify(targeting.exampleKeywords)
        addText(`Example Keywords: ${examples}`, 11)
      }
      yPosition += sectionSpacing
    }

    // Competitors
    if (client.client_competitors && client.client_competitors.length > 0) {
      addText('8. COMPETITORS', 14, true)
      yPosition += 2
      client.client_competitors.forEach((competitor, index) => {
        checkPageBreak(20)
        addText(`Competitor ${index + 1}: ${competitor.name}`, 11)
        if (competitor.googleMapLink) {
          addText(`  Google Map: ${competitor.googleMapLink}`, 10)
        }
        yPosition += 2
      })
      yPosition += sectionSpacing
    }

    // Marketing Requirements
    if (client.client_marketing_requirements) {
      addText('9. MARKETING REQUIREMENTS', 14, true)
      yPosition += 2
      const marketing = client.client_marketing_requirements
      const hasSocialMedia = marketing.socialPostsPerWeek > 0 || marketing.socialPostsPerMonth > 0 || marketing.reelsPerMonth > 0
      const hasContentCreation = marketing.posters || marketing.videos
      const hasPaidAds = marketing.googleAds || marketing.metaAds
      addText(`Social Media: ${hasSocialMedia ? 'Yes' : 'No'}`, 11)
      if (hasSocialMedia) {
        addText(`  Posts per week: ${marketing.socialPostsPerWeek}`, 10)
        addText(`  Posts per month: ${marketing.socialPostsPerMonth}`, 10)
        addText(`  Reels per month: ${marketing.reelsPerMonth}`, 10)
      }
      addText(`Content Creation: ${hasContentCreation ? 'Yes' : 'No'}`, 11)
      if (hasContentCreation) {
        if (marketing.posters) addText(`  Posters: Yes`, 10)
        if (marketing.videos) addText(`  Videos: Yes`, 10)
      }
      addText(`SEO: ${marketing.websiteSeo ? 'Yes' : 'No'}`, 11)
      addText(`GMB Optimization: ${marketing.gmbOptimisation ? 'Yes' : 'No'}`, 11)
      addText(`Paid Advertising: ${hasPaidAds ? 'Yes' : 'No'}`, 11)
      if (hasPaidAds) {
        if (marketing.googleAds) addText(`  Google Ads: Yes`, 10)
        if (marketing.metaAds) addText(`  Meta Ads: Yes`, 10)
      }
      addText(`Review Management: ${marketing.reviewManagement ? 'Yes' : 'No'}`, 11)
      if (marketing.notes) {
        addText(`Notes: ${marketing.notes}`, 11)
      }
      yPosition += sectionSpacing
    }

    // Approval Settings
    if (client.client_approval_settings) {
      addText('10. APPROVAL SETTINGS', 14, true)
      yPosition += 2
      const approvals = client.client_approval_settings
      if (approvals.pointOfContactName) {
        addText(`Point of Contact: ${approvals.pointOfContactName}`, 11)
      }
      if (approvals.approvalMode) {
        addText(`Approval Mode: ${approvals.approvalMode}`, 11)
      }
      if (approvals.approvalTimeHours) {
        addText(`Approval Time: ${approvals.approvalTimeHours} hours`, 11)
      }
      if (approvals.performanceTrackingMode) {
        addText(`Performance Tracking: ${approvals.performanceTrackingMode}`, 11)
      }
      yPosition += sectionSpacing
    }

    // KPIs
    if (client.client_kpi_monthly && client.client_kpi_monthly.length > 0) {
      addText('11. KEY PERFORMANCE INDICATORS (KPIs)', 14, true)
      yPosition += 2
      client.client_kpi_monthly.forEach((kpi, index) => {
        checkPageBreak(25)
        addText(`KPI ${index + 1} - Month: ${kpi.month}`, 11, true)
        addText(`  GMB Calls: ${kpi.gmbCalls}`, 10)
        addText(`  Direction Requests: ${kpi.directionRequests}`, 10)
        addText(`  Website Clicks: ${kpi.websiteClicks}`, 10)
        addText(`  Leads Generated: ${kpi.leadsGenerated}`, 10)
        addText(`  Report Status: ${kpi.reportStatus}`, 10)
        yPosition += 2
      })
      yPosition += sectionSpacing
    }

    // Footer
    const finalY = doc.internal.pageSize.height - 15
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Generated on: ${new Date().toLocaleString()}`,
      margin,
      finalY
    )

    // Generate PDF buffer
    const pdfOutput = doc.output('arraybuffer')
    const buffer = Buffer.from(pdfOutput)

    // Return PDF as response
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="client-onboarding-${client.name.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}

