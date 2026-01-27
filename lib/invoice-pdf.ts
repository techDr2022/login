import { jsPDF } from 'jspdf'
import { InvoicePlanDuration } from '@prisma/client'

interface InvoiceData {
  invoiceNumber: string
  clientName: string
  doctorOrHospitalName: string
  address?: string
  city?: string
  pincode?: string
  email?: string
  phone?: string
  monthlyAmount: number
  planDuration: InvoicePlanDuration | null
  startDate: Date | null
  endDate: Date | null
  dueDate: Date
  services?: string[]
  accountManagerName?: string
  // GST fields
  isGST?: boolean
  clientGSTNumber?: string
  clientGSTRate?: number
  companyGSTNumber?: string
  companyGSTRate?: number
  // Logo
  logoUrl?: string // URL or base64 string for company logo
  companyName?: string
  companyAddress?: string
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  const doc = new jsPDF()
  
  // Colors
  const primaryColor = [41, 128, 185] // Blue
  const secondaryColor = [52, 73, 94] // Dark gray
  const accentColor = [46, 204, 113] // Green
  
  // Header with logo
  let headerHeight = 50
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 210, headerHeight, 'F')
  
  // Add logo if provided
  if (data.logoUrl) {
    try {
      // Logo dimensions: 30x30mm, positioned at top left
      const logoSize = 30
      const logoX = 20
      const logoY = 10
      
      let logoData = data.logoUrl
      
      // If logoUrl is a relative path (starts with /), try to load from filesystem
      if (logoData.startsWith('/') && typeof window === 'undefined') {
        // Server-side: try to load from public folder
        try {
          const fs = await import('fs')
          const path = await import('path')
          const logoPath = path.default.join(process.cwd(), 'public', logoData.substring(1))
          if (fs.default.existsSync(logoPath)) {
            const imageBuffer = fs.default.readFileSync(logoPath)
            const base64 = imageBuffer.toString('base64')
            const ext = path.default.extname(logoPath).substring(1).toLowerCase()
            logoData = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`
          }
        } catch (fsError) {
          console.warn('Could not load logo from filesystem:', fsError)
        }
      }
      
      // Add image if it's a data URL
      if (logoData.startsWith('data:')) {
        doc.addImage(logoData, 'PNG', logoX, logoY, logoSize, logoSize)
      } else if (logoData.startsWith('http://') || logoData.startsWith('https://')) {
        // For HTTP URLs, we'd need to fetch and convert to base64
        // This is complex in server context, so we'll skip for now
        console.warn('HTTP logo URLs not supported in server context. Use base64 or local file path.')
      }
    } catch (error) {
      console.error('Error adding logo to PDF:', error)
    }
  }
  
  // Company name and address (if provided)
  let companyInfoY = 15
  if (data.companyName) {
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(data.companyName, data.logoUrl ? 60 : 20, companyInfoY)
    companyInfoY += 7
  }
  
  if (data.companyAddress) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const addressLines = data.companyAddress.split('\n')
    addressLines.forEach((line, index) => {
      if (line.trim()) {
        doc.text(line.trim(), data.logoUrl ? 60 : 20, companyInfoY + (index * 4))
      }
    })
    companyInfoY += addressLines.length * 4
  }
  
  // Invoice title and details
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', data.logoUrl ? 60 : 20, headerHeight - 15)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Invoice #${data.invoiceNumber}`, 150, 15)
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 150, 22)
  doc.text(`Due Date: ${data.dueDate.toLocaleDateString('en-IN')}`, 150, 29)
  
  // Company GST Number (if GST enabled)
  if (data.isGST && data.companyGSTNumber) {
    doc.setFontSize(9)
    doc.text(`GSTIN: ${data.companyGSTNumber}`, 150, 36)
  }
  
  // Reset text color
  doc.setTextColor(0, 0, 0)
  
  // Company/Client Info Section
  let yPos = headerHeight + 10
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', 20, yPos)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  yPos += 7
  doc.text(data.doctorOrHospitalName, 20, yPos)
  yPos += 6
  doc.text(data.clientName, 20, yPos)
  
  if (data.address) {
    yPos += 6
    doc.text(data.address, 20, yPos)
  }
  
  if (data.city || data.pincode) {
    yPos += 6
    doc.text(`${data.city || ''}${data.city && data.pincode ? ', ' : ''}${data.pincode || ''}`, 20, yPos)
  }
  
  if (data.email) {
    yPos += 6
    doc.text(`Email: ${data.email}`, 20, yPos)
  }
  
  if (data.phone) {
    yPos += 6
    doc.text(`Phone: ${data.phone}`, 20, yPos)
  }
  
  // Client GST Number (if GST enabled)
  if (data.isGST && data.clientGSTNumber) {
    yPos += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`GSTIN: ${data.clientGSTNumber}`, 20, yPos)
    doc.setFont('helvetica', 'normal')
  }
  
  // Service Period Section
  yPos = headerHeight + 10
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Service Period:', 120, yPos)
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  yPos += 7
  
  if (data.planDuration) {
    const planText = data.planDuration === 'ONE_MONTH' ? '1 Month' :
                     data.planDuration === 'THREE_MONTHS' ? '3 Months' :
                     data.planDuration === 'SIX_MONTHS' ? '6 Months' : data.planDuration
    doc.text(`Plan: ${planText}`, 120, yPos)
    yPos += 6
  }
  
  if (data.startDate) {
    doc.text(`Start: ${data.startDate.toLocaleDateString('en-IN')}`, 120, yPos)
    yPos += 6
  }
  
  if (data.endDate) {
    doc.text(`End: ${data.endDate.toLocaleDateString('en-IN')}`, 120, yPos)
    yPos += 6
  }
  
  // Line separator
  yPos = Math.max(headerHeight + 60, yPos + 20)
  doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
  doc.setLineWidth(0.5)
  doc.line(20, yPos, 190, yPos)
  
  // Invoice Items Section
  yPos += 10
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', 20, yPos)
  if (data.isGST) {
    doc.text('Rate', 120, yPos)
    doc.text('GST', 140, yPos)
    doc.text('Amount', 170, yPos)
  } else {
    doc.text('Amount', 160, yPos)
  }
  
  yPos += 8
  doc.setDrawColor(200, 200, 200)
  doc.line(20, yPos, 190, yPos)
  
  yPos += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  // Service description
  let description = `Monthly Service Fee`
  if (data.planDuration) {
    const planText = data.planDuration === 'ONE_MONTH' ? '1 Month' :
                     data.planDuration === 'THREE_MONTHS' ? '3 Months' :
                     data.planDuration === 'SIX_MONTHS' ? '6 Months' : data.planDuration
    description += ` (${planText} Plan)`
  }
  
  doc.text(description, 20, yPos)
  doc.setFont('helvetica', 'bold')
  
  // Calculate GST if applicable
  let subtotal = data.monthlyAmount
  let gstAmount = 0
  let totalAmount = subtotal
  const gstRate = data.isGST ? (data.clientGSTRate || data.companyGSTRate || 18) : 0
  
  if (data.isGST && gstRate > 0) {
    // Calculate GST on subtotal
    gstAmount = (subtotal * gstRate) / 100
    totalAmount = subtotal + gstAmount
    
    doc.text(`₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 120, yPos)
    doc.text(`${gstRate}%`, 140, yPos)
    doc.text(`₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 150, yPos)
    doc.text(`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 170, yPos)
  } else {
    doc.text(`₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 160, yPos)
  }
  doc.setFont('helvetica', 'normal')
  
  // Services list if available
  if (data.services && data.services.length > 0) {
    yPos += 6
    doc.setFontSize(9)
    doc.text('Services Included:', 25, yPos)
    yPos += 5
    data.services.forEach((service, index) => {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }
      doc.text(`  • ${service}`, 25, yPos)
      yPos += 5
    })
  }
  
  // Total Section
  yPos = 240
  doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
  doc.setLineWidth(0.5)
  doc.line(120, yPos, 190, yPos)
  
  yPos += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  
  if (data.isGST && gstRate > 0) {
    doc.text('Subtotal:', 120, yPos)
    doc.text(`₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 170, yPos)
    yPos += 7
    
    doc.text(`GST (${gstRate}%):`, 120, yPos)
    doc.text(`₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 170, yPos)
    yPos += 7
    
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
    doc.setLineWidth(0.3)
    doc.line(120, yPos, 190, yPos)
    yPos += 7
  }
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Amount:', 120, yPos)
  doc.setFontSize(14)
  doc.text(`₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 170, yPos)
  
  // Payment Terms
  yPos += 15
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2])
  doc.text('Payment Terms:', 20, yPos)
  yPos += 6
  doc.text(`Due Date: ${data.dueDate.toLocaleDateString('en-IN')}`, 20, yPos)
  yPos += 6
  doc.text('Please make payment by the due date.', 20, yPos)
  
  // Footer
  yPos = 280
  doc.setDrawColor(200, 200, 200)
  doc.line(20, yPos, 190, yPos)
  
  yPos += 8
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Thank you for your business!', 20, yPos)
  
  if (data.accountManagerName) {
    yPos += 5
    doc.text(`Account Manager: ${data.accountManagerName}`, 20, yPos)
  }
  
  // Return PDF as Uint8Array
  return doc.output('arraybuffer') as unknown as Uint8Array
}

export async function generateInvoicePDFBase64(data: InvoiceData): Promise<string> {
  const pdfBytes = await generateInvoicePDF(data)
  const base64 = Buffer.from(pdfBytes).toString('base64')
  return base64
}
