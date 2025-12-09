"use client"

import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Clock, Edit, CheckCircle, XCircle, FileText, User, Calendar, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function TripHistoryModal({ isOpen, onClose, tripId }) {
  const supabase = createClient()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && tripId) {
      fetchHistory()
    }
  }, [isOpen, tripId])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('trip_history')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          console.warn('Trip history table does not exist yet')
          setHistory([])
          return
        }
        throw error
      }
      setHistory(data || [])
    } catch (err) {
      console.error('Error fetching trip history:', err)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  const getChangeIcon = (changeType) => {
    switch (changeType) {
      case 'edit': return <Edit className="h-5 w-5 text-blue-600" />
      case 'approve': return <CheckCircle className="h-5 w-5 text-emerald-600" />
      case 'decline': return <XCircle className="h-5 w-5 text-red-600" />
      default: return <Clock className="h-5 w-5 text-slate-600" />
    }
  }

  const getChangeBadge = (changeType) => {
    switch (changeType) {
      case 'edit': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Modified</Badge>
      case 'approve': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Approved</Badge>
      case 'decline': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Declined</Badge>
      default: return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getChanges = (previous, current) => {
    const changes = []
    const fields = {
      ordernumber: 'Order Number',
      rate: 'Rate',
      cargo: 'Commodity',
      origin: 'Origin',
      destination: 'Destination',
      notes: 'Notes',
      status: 'Status',
      selected_vehicle_type: 'Vehicle Type',
      estimated_distance: 'Distance (km)',
      total_vehicle_cost: 'Total Cost'
    }

    Object.keys(fields).forEach(key => {
      if (previous?.[key] !== current?.[key]) {
        changes.push({
          field: fields[key],
          from: previous?.[key] || 'Empty',
          to: current?.[key] || 'Empty'
        })
      }
    })

    return changes
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-white rounded-lg shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-600" />
              <Dialog.Title className="text-lg font-medium text-gray-900">
                Trip History #{tripId}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          
          {/* Content */}
          <div className="h-full overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600"></div>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Clock className="h-8 w-8 text-gray-400 mb-3" />
                <p className="text-gray-600 text-sm">No changes recorded yet</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="space-y-3">
                  {history.map((entry, index) => {
                    const changes = getChanges(entry.previous_data, entry.new_data)
                    
                    return (
                      <div key={entry.id} className="border rounded-lg bg-white hover:bg-gray-50">
                        <div className="p-3">
                          {/* Entry Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${
                                entry.change_type === 'edit' ? 'bg-blue-100 text-blue-700' :
                                entry.change_type === 'approve' ? 'bg-green-100 text-green-700' :
                                entry.change_type === 'decline' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {getChangeIcon(entry.change_type)}
                              </div>
                              <span className="font-medium text-gray-900 text-sm capitalize">
                                {entry.change_type === 'edit' ? 'Modified' :
                                 entry.change_type === 'approve' ? 'Approved' :
                                 entry.change_type === 'decline' ? 'Declined' : entry.change_type}
                              </span>
                              {index === 0 && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Latest</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.created_at).toLocaleDateString('en-GB')} {new Date(entry.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          {/* Changes */}
                          {changes.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {changes.map((change, i) => (
                                <div key={i} className="bg-gray-50 rounded p-2 text-xs">
                                  <div className="font-medium text-gray-700 mb-1">{change.field}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded border">{change.from}</span>
                                    <ArrowRight className="h-3 w-3 text-gray-400" />
                                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded border">{change.to}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}