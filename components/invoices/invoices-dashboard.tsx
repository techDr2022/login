'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Calendar, DollarSign, AlertCircle, CheckCircle2, Clock, Edit, CheckCircle, Send } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { getClientInvoices, updateClientInvoice, markPaymentAsReceived, sendInvoiceToClient, ClientInvoice } from '@/app/actions/invoice-actions'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function InvoicesDashboard() {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [editingInvoice, setEditingInvoice] = useState<ClientInvoice | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [planFilter, setPlanFilter] = useState<'ALL' | 'ONE_MONTH' | 'THREE_MONTHS' | 'SIX_MONTHS'>('ALL')
  const [formData, setFormData] = useState({
    startDate: null as Date | null,
    endDate: null as Date | null,
    monthlyAmount: '' as string | number,
    planDuration: '' as string,
    nextPaymentDate: null as Date | null,
    lastPaymentDate: null as Date | null,
    isGST: false,
    gstNumber: '' as string,
    gstRate: '' as string | number,
  })

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const data = await getClientInvoices()
      setInvoices(data)
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (invoice: ClientInvoice) => {
    setEditingInvoice(invoice)
    setFormData({
      startDate: invoice.startDate ? new Date(invoice.startDate) : null,
      endDate: invoice.endDate ? new Date(invoice.endDate) : null,
      monthlyAmount: invoice.monthlyAmount || '',
      planDuration: invoice.planDuration || '',
      nextPaymentDate: invoice.nextPaymentDate ? new Date(invoice.nextPaymentDate) : null,
      lastPaymentDate: invoice.lastPaymentDate ? new Date(invoice.lastPaymentDate) : null,
      isGST: invoice.isGST || false,
      gstNumber: invoice.gstNumber || '',
      gstRate: invoice.gstRate || '',
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingInvoice) return

    try {
      await updateClientInvoice(editingInvoice.id, {
        startDate: formData.startDate,
        endDate: formData.endDate,
        monthlyAmount: formData.monthlyAmount ? Number(formData.monthlyAmount) : null,
        planDuration: formData.planDuration ? (formData.planDuration as 'ONE_MONTH' | 'THREE_MONTHS' | 'SIX_MONTHS') : null,
        nextPaymentDate: formData.nextPaymentDate,
        lastPaymentDate: formData.lastPaymentDate,
        isGST: formData.isGST,
        gstNumber: formData.gstNumber || null,
        gstRate: formData.gstRate ? Number(formData.gstRate) : null,
      })
      setIsDialogOpen(false)
      setEditingInvoice(null)
      await loadInvoices()
    } catch (error) {
      console.error('Error updating invoice:', error)
      alert('Failed to update invoice. Please try again.')
    }
  }

  const handleMarkAsPaid = async (invoice: ClientInvoice) => {
    if (!confirm(`Mark payment as received for ${invoice.name}? This will update the last payment date to today and calculate the next payment date based on the plan duration.`)) {
      return
    }

    try {
      await markPaymentAsReceived(invoice.id)
      await loadInvoices()
    } catch (error: any) {
      console.error('Error marking payment as received:', error)
      alert(error.message || 'Failed to mark payment as received. Please try again.')
    }
  }

  const handleSendInvoice = async (invoice: ClientInvoice) => {
    if (!confirm(`Send invoice to ${invoice.name} via WhatsApp?`)) {
      return
    }

    try {
      const result = await sendInvoiceToClient(invoice.id)
      alert(`Invoice sent successfully to ${invoice.name}!\nInvoice Number: ${result.invoiceNumber}`)
      await loadInvoices()
    } catch (error: any) {
      console.error('Error sending invoice:', error)
      alert(error.message || 'Failed to send invoice. Please try again.')
    }
  }

  const getDaysUntilPayment = (nextPaymentDate: Date | null): number | null => {
    if (!nextPaymentDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const paymentDate = new Date(nextPaymentDate)
    paymentDate.setHours(0, 0, 0, 0)
    const diffTime = paymentDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getPaymentStatus = (nextPaymentDate: Date | null): 'upcoming' | 'due' | 'overdue' | 'none' => {
    if (!nextPaymentDate) return 'none'
    const days = getDaysUntilPayment(nextPaymentDate)
    if (days === null) return 'none'
    if (days < 0) return 'overdue'
    if (days <= 7) return 'due'
    return 'upcoming'
  }

  const upcomingPayments = invoices.filter(
    (inv) => inv.nextPaymentDate && getDaysUntilPayment(inv.nextPaymentDate) !== null && getDaysUntilPayment(inv.nextPaymentDate)! <= 7 && getDaysUntilPayment(inv.nextPaymentDate)! >= 0
  )
  const overduePayments = invoices.filter(
    (inv) => inv.nextPaymentDate && getDaysUntilPayment(inv.nextPaymentDate) !== null && getDaysUntilPayment(inv.nextPaymentDate)! < 0
  )

  // Filter invoices by plan duration
  const filteredInvoices = invoices.filter((inv) => {
    if (planFilter === 'ALL') return true
    return inv.planDuration === planFilter
  }).sort((a, b) => {
    // Sort by next payment date (nearest first)
    if (!a.nextPaymentDate && !b.nextPaymentDate) return 0
    if (!a.nextPaymentDate) return 1
    if (!b.nextPaymentDate) return -1
    return new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime()
  })

  const totalMonthlyRevenue = invoices.reduce((sum, inv) => sum + (inv.monthlyAmount || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading invoices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">Client Invoices</p>
        <h1 className="text-2xl font-semibold">Invoice Management</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalMonthlyRevenue.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground mt-1">Monthly total</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Payments</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{upcomingPayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Due in 7 days</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overduePayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Clients</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{invoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Client Invoices</CardTitle>
              <CardDescription>
                Sorted by nearest payment due date. Manage client payment dates and amounts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="planFilter" className="text-xs text-muted-foreground">
                  Plan Filter
                </Label>
                <Select
                  value={planFilter}
                  onValueChange={(value) =>
                    setPlanFilter(value as 'ALL' | 'ONE_MONTH' | 'THREE_MONTHS' | 'SIX_MONTHS')
                  }
                >
                  <SelectTrigger id="planFilter" className="h-8 w-40">
                    <SelectValue placeholder="All plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All plans</SelectItem>
                    <SelectItem value="ONE_MONTH">1 Month</SelectItem>
                    <SelectItem value="THREE_MONTHS">3 Months</SelectItem>
                    <SelectItem value="SIX_MONTHS">6 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="outline" className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Sorted by Due Date
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <Calendar className="h-16 w-16 text-muted-foreground/50" />
              <div className="space-y-2">
                <p className="text-lg font-medium">No invoice data found</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  To add invoice information for clients, go to the{' '}
                  <a href="/clients" className="text-primary hover:underline font-medium">
                    Clients page
                  </a>
                  , click on a client, and use the "Invoice" tab in the edit dialog to add:
                </p>
                <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-1 mt-4">
                  <li>• Project start and end dates</li>
                  <li>• Monthly payment amount</li>
                  <li>• Next payment due date</li>
                  <li>• Last payment received date</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-4">
                  Payment reminders will be sent to super admins via WhatsApp 7 days before the due date.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Project Start</TableHead>
                    <TableHead>Project End</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monthly Amount</TableHead>
                    <TableHead className="flex items-center gap-2">
                      <span>Next Payment</span>
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    </TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice, index) => {
                    const paymentStatus = getPaymentStatus(invoice.nextPaymentDate)
                    const daysUntil = getDaysUntilPayment(invoice.nextPaymentDate)
                    const isOverdue = daysUntil !== null && daysUntil < 0
                    const isDueSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7

                    return (
                      <TableRow 
                        key={invoice.id}
                        className={
                          isOverdue ? 'bg-red-50 dark:bg-red-950/20' :
                          isDueSoon ? 'bg-yellow-50 dark:bg-yellow-950/20' :
                          index < 3 ? 'bg-blue-50/50 dark:bg-blue-950/10' :
                          ''
                        }
                      >
                        <TableCell className="font-medium">
                          <div>
                            <div>{invoice.name}</div>
                            <div className="text-xs text-muted-foreground">{invoice.doctorOrHospitalName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {invoice.startDate ? format(new Date(invoice.startDate), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          {invoice.endDate ? format(new Date(invoice.endDate), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          {invoice.planDuration ? (
                            <Badge variant="outline">
                              {invoice.planDuration === 'ONE_MONTH' ? '1 Month' :
                               invoice.planDuration === 'THREE_MONTHS' ? '3 Months' :
                               invoice.planDuration === 'SIX_MONTHS' ? '6 Months' : invoice.planDuration}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {invoice.monthlyAmount ? `₹${invoice.monthlyAmount.toLocaleString('en-IN')}` : '-'}
                        </TableCell>
                        <TableCell>
                          {invoice.nextPaymentDate ? (
                            <div className="space-y-1">
                              <div className="font-medium">{format(new Date(invoice.nextPaymentDate), 'MMM dd, yyyy')}</div>
                              {daysUntil !== null && (
                                <div className={`text-xs ${
                                  daysUntil < 0 ? 'text-red-600 font-semibold' : 
                                  daysUntil === 0 ? 'text-orange-600 font-semibold' : 
                                  daysUntil <= 7 ? 'text-yellow-600 font-medium' : 
                                  'text-muted-foreground'
                                }`}>
                                  {daysUntil < 0 ? `⚠️ ${Math.abs(daysUntil)} days overdue` : 
                                   daysUntil === 0 ? '⚠️ Due today' : 
                                   daysUntil <= 7 ? `⏰ ${daysUntil} days left` : 
                                   `${daysUntil} days left`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.lastPaymentDate ? (
                            <div className="space-y-1">
                              <div className="font-medium">{format(new Date(invoice.lastPaymentDate), 'MMM dd, yyyy')}</div>
                              <div className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Paid
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {paymentStatus === 'overdue' && (
                            <Badge variant="destructive">Overdue</Badge>
                          )}
                          {paymentStatus === 'due' && (
                            <Badge variant="default" className="bg-yellow-600">Due Soon</Badge>
                          )}
                          {paymentStatus === 'upcoming' && (
                            <Badge variant="secondary">Upcoming</Badge>
                          )}
                          {paymentStatus === 'none' && <Badge variant="outline">No Date</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* Download / Generate PDF Invoice */}
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              title="Download invoice PDF"
                            >
                              <a
                                href={`/api/invoices/${invoice.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                PDF
                              </a>
                            </Button>

                            {/* Send invoice via WhatsApp */}
                            {invoice.monthlyAmount && invoice.nextPaymentDate && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSendInvoice(invoice)}
                                title="Send invoice to client via WhatsApp"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Mark as Paid */}
                            {invoice.nextPaymentDate && daysUntil !== null && daysUntil <= 0 && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleMarkAsPaid(invoice)}
                                className="bg-green-600 hover:bg-green-700"
                                title="Mark payment as received"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Paid
                              </Button>
                            )}

                            {/* Edit Invoice */}
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(invoice)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Invoice Details</DialogTitle>
            <DialogDescription>
              Update project dates and payment information for {editingInvoice?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Project Start Date</Label>
                <DatePicker
                  date={formData.startDate}
                  onSelect={(date) => setFormData({ ...formData, startDate: date })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Project End Date</Label>
                <DatePicker
                  date={formData.endDate}
                  onSelect={(date) => setFormData({ ...formData, endDate: date })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyAmount">Monthly Amount (₹)</Label>
                <Input
                  id="monthlyAmount"
                  type="number"
                  value={formData.monthlyAmount}
                  onChange={(e) => setFormData({ ...formData, monthlyAmount: e.target.value })}
                  placeholder="Enter monthly amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planDuration">Plan Duration</Label>
                <Select
                  value={formData.planDuration}
                  onValueChange={(value) => {
                    setFormData({ ...formData, planDuration: value })
                    // Auto-calculate end date if start date is set
                    if (value && formData.startDate) {
                      const startDate = new Date(formData.startDate)
                      let monthsToAdd = 0
                      if (value === 'ONE_MONTH') monthsToAdd = 1
                      else if (value === 'THREE_MONTHS') monthsToAdd = 3
                      else if (value === 'SIX_MONTHS') monthsToAdd = 6
                      
                      const endDate = new Date(startDate)
                      endDate.setMonth(endDate.getMonth() + monthsToAdd)
                      setFormData({ ...formData, planDuration: value, endDate })
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
                <Label htmlFor="nextPaymentDate">Next Payment Date</Label>
                <DatePicker
                  date={formData.nextPaymentDate}
                  onSelect={(date) => setFormData({ ...formData, nextPaymentDate: date })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastPaymentDate">Last Payment Date</Label>
                <DatePicker
                  date={formData.lastPaymentDate}
                  onSelect={(date) => setFormData({ ...formData, lastPaymentDate: date })}
                />
              </div>
            </div>
            
            {/* GST Section */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox
                  id="isGST"
                  checked={formData.isGST}
                  onCheckedChange={(checked) => setFormData({ ...formData, isGST: checked === true })}
                />
                <Label htmlFor="isGST" className="text-sm font-medium cursor-pointer">
                  Client is GST registered
                </Label>
              </div>
              
              {formData.isGST && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="gstNumber">GST Number</Label>
                    <Input
                      id="gstNumber"
                      type="text"
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                      placeholder="e.g., 27AABCU9603R1ZM"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gstRate">GST Rate (%)</Label>
                    <Input
                      id="gstRate"
                      type="number"
                      value={formData.gstRate}
                      onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                      placeholder="e.g., 18"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
