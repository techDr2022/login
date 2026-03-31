export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { getInvoicesUnlockUserIdFromRequest } from '@/lib/invoices-unlock'
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

    const unlockedUserId = await getInvoicesUnlockUserIdFromRequest(request)
    if (unlockedUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unlock the Invoices tab first (password or OTP).' },
        { status: 403 }
      )
    }

    const { id } = await context.params

    // Get client data (id is client id - invoices are per client)
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        doctorOrHospitalName: true,
        addressLine: true,
        area: true,
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
        discountPercent: true,
        invoiceLineItems: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const hasLineItems = client.invoiceLineItems && Array.isArray(client.invoiceLineItems) && (client.invoiceLineItems as unknown[]).length > 0
    const hasAmount = (client.monthlyAmount != null && client.monthlyAmount > 0) || hasLineItems
    if (!hasAmount || !client.nextPaymentDate) {
      return NextResponse.json(
        { error: 'Invoice information is incomplete' },
        { status: 400 }
      )
    }

    // Generate invoice number
    const today = new Date()
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + 7)
    const invoiceNumber = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${client.id.substring(0, 4).toUpperCase()}`

    // Get company details from environment variables
    const companyName = process.env.COMPANY_NAME || 'TechDR'
    const companyAddress = process.env.COMPANY_ADDRESS || ''
    const companyGSTNumber = process.env.COMPANY_GST_NUMBER || ''
    const companyGSTRate = parseFloat(process.env.COMPANY_GST_RATE || '18')
    const companyEmail = process.env.COMPANY_EMAIL
    const companyPhone = process.env.COMPANY_PHONE
    const companyPAN = process.env.COMPANY_PAN
    const bankName = process.env.BANK_NAME
    const bankAccountName = process.env.BANK_ACCOUNT_NAME
    const bankAccountNumber = process.env.BANK_ACCOUNT_NUMBER
    const bankIFSC = process.env.BANK_IFSC
    const bankAccountType = process.env.BANK_ACCOUNT_TYPE || 'Current'
    const upiId = process.env.UPI_ID
    const upiQrImageUrl = process.env.UPI_QR_IMAGE_URL
    const logoUrl = process.env.COMPANY_LOGO_URL || '/logo.png'

    // Generate PDF
    const pdfBytes = await generateInvoicePDF({
      invoiceNumber,
      clientName: client.name,
      doctorOrHospitalName: client.doctorOrHospitalName,
      address: client.addressLine || undefined,
      area: client.area || undefined,
      city: client.city || undefined,
      pincode: client.pincode || undefined,
      email: client.email || undefined,
      phone: client.phonePrimary || client.phoneWhatsApp || undefined,
      monthlyAmount: client.monthlyAmount ?? 0,
      planDuration: client.planDuration,
      startDate: client.startDate,
      endDate: client.endDate,
      dueDate,
      services: client.services.length > 0 ? client.services : undefined,
      // GST and discount
      isGST: client.isGST || false,
      clientGSTNumber: client.gstNumber || undefined,
      clientGSTRate: client.gstRate || undefined,
      companyGSTNumber: companyGSTNumber || undefined,
      companyGSTRate: companyGSTRate || undefined,
      discountPercent: client.discountPercent ?? undefined,
      invoiceLineItems: (client.invoiceLineItems as Array<{ description: string; qty: number; rate: number; discountPercent?: number }> | null) ?? undefined,
      // Logo and company info
      logoUrl: logoUrl || undefined,
      companyName: companyName || undefined,
      companyAddress: companyAddress || undefined,
      companyEmail: companyEmail || undefined,
      companyPhone: companyPhone || undefined,
      companyPAN: companyPAN || undefined,
      bankName: bankName || undefined,
      bankAccountName: bankAccountName || undefined,
      bankAccountNumber: bankAccountNumber || undefined,
      bankIFSC: bankIFSC || undefined,
      bankAccountType: bankAccountType || undefined,
      upiId: upiId || undefined,
      upiQrImageUrl: upiQrImageUrl || undefined,
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
