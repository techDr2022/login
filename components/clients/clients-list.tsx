'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Search, Trash2, Edit, Users } from 'lucide-react'
import { createClient, updateClient, deleteClient } from '@/app/actions/client-actions'
import { useSession } from 'next-auth/react'
import { UserRole } from '@prisma/client'
import { canManageClients } from '@/lib/rbac'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Client {
  id: string
  name: string
  doctorOrHospitalName: string
  location: string
  services: string[]
  accountManagerId?: string
  accountManager?: {
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

  const canManage = session?.user.role && canManageClients(session.user.role as UserRole)

  useEffect(() => {
    fetchClients()
    if (canManage) {
      fetchManagers()
    }
  }, [page, search, canManage])

  const fetchManagers = async () => {
    try {
      const res = await fetch('/api/users?role=MANAGER')
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
        limit: '10',
        ...(search && { search }),
      })
      const res = await fetch(`/api/clients?${params}`)
      const data = await res.json()
      setClients(data.clients || [])
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-10 rounded-xl"
            />
          </div>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => router.push('/clients/new')} className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
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
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Doctor/Hospital</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Account Manager</TableHead>
                <TableHead>Tasks</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-sm font-medium text-muted-foreground">No clients found</p>
                      {canManage && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Get started by creating a new client
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
              clients.map((client) => (
                <TableRow 
                  key={client.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors" 
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{client.doctorOrHospitalName}</TableCell>
                  <TableCell className="text-muted-foreground">{client.location}</TableCell>
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
                  <TableCell className="text-muted-foreground">{client.accountManager?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{client._count?.tasks || 0}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(client)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(client.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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

