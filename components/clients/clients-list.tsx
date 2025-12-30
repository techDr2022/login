'use client'

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Trash2, Edit, Users, MapPin, Phone, Mail, Calendar, Building2, Filter, Grid, List } from 'lucide-react'
import { createClient, updateClient, deleteClient, updateClientStatus, bulkUpdateClientStatus } from '@/app/actions/client-actions'
import { useSession } from 'next-auth/react'
import { UserRole, ClientStatus } from '@prisma/client'
import { canManageClients, canCreateClient, canEditClient } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface Client {
  id: string
  name: string
  doctorOrHospitalName: string
  location: string
  services: string[]
  status?: ClientStatus
  accountManagerId?: string
  type?: string
  email?: string
  phonePrimary?: string
  createdAt?: string
  User?: {
    id: string
    name: string
    email: string
  }
  _count?: {
    tasks: number
  }
}

export function ClientsList() {
  const { data: session } = useSession()
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    doctorOrHospitalName: '',
    location: '',
    services: '',
    accountManagerId: '',
  })
  const [error, setError] = useState('')
  const [managers, setManagers] = useState<Array<{ id: string; name: string }>>([])
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const selectAllCheckboxRef = useRef<HTMLButtonElement>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const canManage = session?.user.role && canManageClients(session.user.role as UserRole)
  const canEdit = session?.user.role && canEditClient(session.user.role as UserRole)
  const canCreate = session?.user.role && canCreateClient(session.user.role as UserRole)

  useEffect(() => {
    fetchClients()
    if (canCreate) {
      fetchManagers()
    }
  }, [page, search, canCreate, statusFilter])

  const fetchManagers = async () => {
    try {
      // For client account managers, we use employees as the primary contacts.
      // This fetches all active employees so they can be assigned as account managers.
      const res = await fetch('/api/users?role=EMPLOYEE')
      const data = await res.json()
      setManagers(data.users || [])
    } catch (err) {
      console.error('Failed to fetch managers:', err)
    }
  }

  const fetchClients = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        ...(search && { search }),
      })
      const res = await fetch(`/api/clients?${params}`)
      const data = await res.json()
      let filteredClients = data.clients || []
      
      // Apply status filter
      if (statusFilter !== 'all') {
        filteredClients = filteredClients.filter((c: Client) => c.status === statusFilter)
      }
      
      setClients(filteredClients)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err) {
      setError('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const services = formData.services.split(',').map(s => s.trim()).filter(s => s)
      
      if (editingClient) {
        await updateClient(editingClient.id, {
          ...formData,
          services,
          accountManagerId: formData.accountManagerId || undefined,
        })
      } else {
        await createClient({
          ...formData,
          services,
          accountManagerId: formData.accountManagerId || undefined,
        })
      }
      
      setDialogOpen(false)
      resetForm()
      fetchClients()
    } catch (err: any) {
      setError(err.message || 'Failed to save client')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return

    try {
      await deleteClient(id)
      fetchClients()
    } catch (err: any) {
      setError(err.message || 'Failed to delete client')
    }
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      doctorOrHospitalName: client.doctorOrHospitalName,
      location: client.location,
      services: client.services.join(', '),
      accountManagerId: client.accountManagerId || '',
    })
    setDialogOpen(true)
  }

  const handleStatusChange = async (clientId: string, newStatus: ClientStatus) => {
    try {
      await updateClientStatus(clientId, newStatus)
      fetchClients()
    } catch (err: any) {
      setError(err.message || 'Failed to update client status')
    }
  }

  const handleBulkStatusChange = async (newStatus: ClientStatus) => {
    if (selectedClients.size === 0) return
    
    try {
      await bulkUpdateClientStatus(Array.from(selectedClients), newStatus)
      setSelectedClients(new Set())
      fetchClients()
    } catch (err: any) {
      setError(err.message || 'Failed to update client statuses')
    }
  }

  const handleSelectClient = (clientId: string, checked: boolean) => {
    const newSelected = new Set(selectedClients)
    if (checked) {
      newSelected.add(clientId)
    } else {
      newSelected.delete(clientId)
    }
    setSelectedClients(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClients(new Set(clients.map(c => c.id)))
    } else {
      setSelectedClients(new Set())
    }
  }

  const isAllSelected = clients.length > 0 && selectedClients.size === clients.length
  const isIndeterminate = selectedClients.size > 0 && selectedClients.size < clients.length

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      const input = selectAllCheckboxRef.current.querySelector('input')
      if (input) {
        input.indeterminate = isIndeterminate
      }
    }
  }, [isIndeterminate])

  const getStatusBadge = (status?: ClientStatus) => {
    if (!status) return null
    const variants: Record<ClientStatus, any> = {
      ONBOARDING: 'secondary',
      ACTIVE: 'default',
      PAUSED: 'outline',
    }
    const colors: Record<ClientStatus, string> = {
      ONBOARDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      ACTIVE: 'bg-green-100 text-green-800 border-green-200',
      PAUSED: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    return (
      <Badge variant={variants[status] || 'secondary'} className={colors[status]}>
        {status}
      </Badge>
    )
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const filteredClients = statusFilter === 'all' 
    ? clients 
    : clients.filter(c => c.status === statusFilter)

  const resetForm = () => {
    setEditingClient(null)
    setFormData({
      name: '',
      doctorOrHospitalName: '',
      location: '',
      services: '',
      accountManagerId: '',
    })
    setError('')
  }

  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading clients...</p>
        </div>
      </div>
    )
  }

  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === 'ACTIVE').length,
    onboarding: clients.filter(c => c.status === 'ONBOARDING').length,
    paused: clients.filter(c => c.status === 'PAUSED').length,
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage and view all your clients</p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push('/clients/new')} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.onboarding}</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.paused}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search clients by name, hospital, or location..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10 rounded-xl"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ONBOARDING">Onboarding</SelectItem>
              <SelectItem value="PAUSED">Paused</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-xl overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="rounded-none"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {canManage && selectedClients.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedClients.size} selected
            </span>
            <Select
              onValueChange={(value) => handleBulkStatusChange(value as ClientStatus)}
            >
              <SelectTrigger className="w-[140px] rounded-xl">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PAUSED">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setSelectedClients(new Set())}
              className="rounded-xl"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {canCreate && (
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingClient ? 'Edit Client' : 'Create Client'}</DialogTitle>
                <DialogDescription>
                  {editingClient ? 'Update client information' : 'Add a new client'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="doctorOrHospitalName">Doctor/Hospital Name</Label>
                  <Input
                    id="doctorOrHospitalName"
                    value={formData.doctorOrHospitalName}
                    onChange={(e) => setFormData({ ...formData, doctorOrHospitalName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="services">Services (comma-separated)</Label>
                  <Input
                    id="services"
                    value={formData.services}
                    onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                    placeholder="Consultation, Surgery, Diagnostics"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="accountManagerId">Account Manager</Label>
                  <Select
                    value={formData.accountManagerId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, accountManagerId: value || '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {viewMode === 'grid' ? (
        <>
          {filteredClients.length === 0 ? (
            <Card className="rounded-xl">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center">
                  <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">No clients found</p>
                  {canCreate && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Get started by creating a new client
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client) => (
                <Card 
                  key={client.id} 
                  className="rounded-xl hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-primary/50"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {getInitials(client.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{client.name}</CardTitle>
                          <CardDescription className="truncate">{client.doctorOrHospitalName}</CardDescription>
                        </div>
                      </div>
                      {(canEdit || canManage) && (
                        <div onClick={(e) => e.stopPropagation()} className="flex gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(client)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(client.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div onClick={(e) => e.stopPropagation()}>
                      {canManage ? (
                        <Select
                          value={client.status || 'ONBOARDING'}
                          onValueChange={(value) => handleStatusChange(client.id, value as ClientStatus)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="PAUSED">Paused</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(client.status)
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{client.location}</span>
                      </div>
                      {client.phonePrimary && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span>{client.phonePrimary}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.type && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="w-4 h-4" />
                          <span>{client.type}</span>
                        </div>
                      )}
                      {client.createdAt && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>Created {new Date(client.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Services</span>
                        <Badge variant="outline">{client.services.length}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {client.services.slice(0, 3).map((service, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{service}</Badge>
                        ))}
                        {client.services.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{client.services.length - 3}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        {client.User && (
                          <>
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs bg-secondary">
                                {getInitials(client.User.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground truncate">{client.User.name}</span>
                          </>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {client._count?.tasks || 0} tasks
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && (
                    <TableHead className="w-12">
                      <Checkbox
                        ref={selectAllCheckboxRef}
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Name</TableHead>
                  <TableHead>Doctor/Hospital</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Account Manager</TableHead>
                  <TableHead>Tasks</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 9 : 7} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-sm font-medium text-muted-foreground">No clients found</p>
                        {canCreate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Get started by creating a new client
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                filteredClients.map((client) => (
                  <TableRow 
                    key={client.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors" 
                    onClick={() => router.push(`/clients/${client.id}`)}
                  >
                    {canManage && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedClients.has(client.id)}
                          onCheckedChange={(checked) => handleSelectClient(client.id, checked as boolean)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell className="text-muted-foreground">{client.doctorOrHospitalName}</TableCell>
                    <TableCell className="text-muted-foreground">{client.location}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canManage ? (
                        <Select
                          value={client.status || 'ONBOARDING'}
                          onValueChange={(value) => handleStatusChange(client.id, value as ClientStatus)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="PAUSED">Paused</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(client.status)
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {client.services.slice(0, 2).map((service, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{service}</Badge>
                        ))}
                        {client.services.length > 2 && (
                          <Badge variant="outline" className="text-xs">+{client.services.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.User?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{client._count?.tasks || 0}</Badge>
                    </TableCell>
                    {(canEdit || canManage) && (
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(client)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canManage && (
                            <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(client.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

