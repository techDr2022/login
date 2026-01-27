export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { generateInvoicePDF } from '@/lib/invoice-pdf'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    // Get client data
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        doctorOrHospitalName: true,
        addressLine: true,
        city: true,
        pincode: true,
        email: true,
        phonePrimary: true,
        phoneWhatsApp: true,
        monthlyAmount: true,
        planDuration: true,
        startDate: true,
        endDate: true,
        nextPaymentDate: true,
        services: true,
        isGST: true,
        gstNumber: true,
        gstRate: true,
        User: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (!client.monthlyAmount || !client.nextPaymentDate) {
      return NextResponse.json(
        { error: 'Invoice information is incomplete' },
        { status: 400 }
      )
    }

    // Generate invoice number
    const today = new Date()
    const invoiceNumber = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${client.id.substring(0, 4).toUpperCase()}`

    // Get company details from environment variables
    const companyName = process.env.COMPANY_NAME || 'TechDR'
    const companyAddress = process.env.COMPANY_ADDRESS || ''
    const companyGSTNumber = process.env.COMPANY_GST_NUMBER || ''
    const companyGSTRate = parseFloat(process.env.COMPANY_GST_RATE || '18')
    const logoUrl = process.env.COMPANY_LOGO_URL || '/logo.png' // Default logo path

    // Generate PDF
    const pdfBytes = await generateInvoicePDF({
      invoiceNumber,
      clientName: client.name,
      doctorOrHospitalName: client.doctorOrHospitalName,
      address: client.addressLine || undefined,
      city: client.city || undefined,
      pincode: client.pincode || undefined,
      email: client.email || undefined,
      phone: client.phonePrimary || client.phoneWhatsApp || undefined,
      monthlyAmount: client.monthlyAmount,
      planDuration: client.planDuration,
      startDate: client.startDate,
      endDate: client.endDate,
      dueDate: client.nextPaymentDate,
      services: client.services.length > 0 ? client.services : undefined,
      accountManagerName: client.User?.name || undefined,
      // GST fields
      isGST: client.isGST || false,
      clientGSTNumber: client.gstNumber || undefined,
      clientGSTRate: client.gstRate || undefined,
      companyGSTNumber: companyGSTNumber || undefined,
      companyGSTRate: companyGSTRate || undefined,
      // Logo and company info
      logoUrl: logoUrl || undefined,
      companyName: companyName || undefined,
      companyAddress: companyAddress || undefined,
    })

    // Return PDF
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating invoice PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate invoice PDF' },
      { status: 500 }
    )
  }
}
