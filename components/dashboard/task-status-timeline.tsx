'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckSquare2 } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface StatusChange {
  id: string
  taskId: string
  taskTitle: string
  oldStatus?: string
  newStatus: string
  changedBy: string
  changedByName: string
  timestamp: string
}

export function TaskStatusTimeline() {
  const { data: session } = useSession()
  const [statusChanges, setStatusChanges] = useState<StatusChange[]>([])
  const [loading, setLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const fetchStatusChanges = async () => {
      try {
        const res = await fetch('/api/tasks/status-timeline')
        if (res.ok) {
          const data = await res.json()
          setStatusChanges(data.statusChanges || [])
        }
      } catch (err) {
        console.error('Failed to fetch status timeline:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStatusChanges()

    // Set up SSE for real-time updates
    if (session?.user?.id) {
      const eventSource = new EventSource('/api/tasks/sse')
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'status_change') {
            // Add new status change to the beginning of the list
            setStatusChanges((prev) => [data.statusChange, ...prev].slice(0, 20))
          } else if (data.type === 'task_update' && data.task) {
            // If a task was updated, refresh the timeline
            fetchStatusChanges()
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err)
        }
      }

      eventSource.onerror = () => {
        // Reconnect on error
        if (eventSource.readyState === EventSource.CLOSED) {
          setTimeout(() => {
            if (session?.user?.id) {
              const newEventSource = new EventSource('/api/tasks/sse')
              eventSourceRef.current = newEventSource
            }
          }, 3000)
        }
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [session])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>
      case 'Review':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Review</Badge>
      case 'InProgress':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">In Progress</Badge>
      case 'Pending':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Pending</Badge>
      case 'Rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Task Status Timeline</CardTitle>
          <CardDescription className="text-sm">Recent task status changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Task Status Timeline</CardTitle>
            <CardDescription className="text-sm">Recent task status changes in real-time</CardDescription>
          </div>
          <Clock className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {statusChanges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckSquare2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">No status changes yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
              
              {/* Timeline items */}
              <div className="space-y-4">
                {statusChanges.map((change, index) => (
                  <div key={change.id} className="relative flex items-start gap-4">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 border-primary">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 space-y-1 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link 
                          href={`/tasks/${change.taskId}`}
                          className="font-medium hover:underline text-sm"
                        >
                          {change.taskTitle}
                        </Link>
                        {change.oldStatus && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-xs text-muted-foreground line-through">
                              {change.oldStatus}
                            </span>
                          </>
                        )}
                        <span className="text-muted-foreground">→</span>
                        {getStatusBadge(change.newStatus)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>by {change.changedByName}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })}</span>
                        <span>•</span>
                        <span>{format(new Date(change.timestamp), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

