"use client"

import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { X, AlertTriangle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ElevationApprovalModal } from '@/components/ui/elevation-approval-modal'

export function ElevationNotification({ userRole, userId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [elevatedTrips, setElevatedTrips] = useState([])
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (userRole === 'admin') {
      checkForElevatedTrips()
    }
  }, [userRole])

  const checkForElevatedTrips = async () => {
    try {
      const { data: trips, error } = await supabase
        .from('trips')
        .select('*')
        .eq('elevate', true)
        .eq('elevate_to', userId)
        .neq('status', 'completed')
        .neq('status', 'rejected')

      if (error) throw error

      if (trips && trips.length > 0) {
        setElevatedTrips(trips)
        setIsOpen(true)
      }
    } catch (error) {
      console.error('Error checking elevated trips:', error)
    }
  }

  const handleApprove = async (tripId) => {
    try {
      // Get current trip data for history
      const { data: currentTrip } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single()

      const updateData = { 
        elevate: false, 
        elevate_to: null,
        status: 'approved',
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId)

      if (error) throw error

      // Record approval in history
      await supabase
        .from('trip_history')
        .insert({
          trip_id: tripId,
          changed_by: userId,
          change_type: 'approve',
          previous_data: currentTrip,
          new_data: { ...currentTrip, ...updateData },
          change_reason: 'Trip approved by admin'
        })

      // Remove from elevated trips list
      setElevatedTrips(prev => prev.filter(trip => trip.id !== tripId))
      
      if (elevatedTrips.length <= 1) {
        setIsOpen(false)
      }
    } catch (error) {
      console.error('Error approving trip:', error)
      throw error
    }
  }

  const handleReject = async (tripId, reason) => {
    try {
      // Get current trip data for history
      const { data: currentTrip } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single()

      const updateData = { 
        elevate: false, 
        elevate_to: null,
        status: 'rejected',
        notes: reason,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId)

      if (error) throw error

      // Record rejection in history
      await supabase
        .from('trip_history')
        .insert({
          trip_id: tripId,
          changed_by: userId,
          change_type: 'reject',
          previous_data: currentTrip,
          new_data: { ...currentTrip, ...updateData },
          change_reason: reason
        })

      // Remove from elevated trips list
      setElevatedTrips(prev => prev.filter(trip => trip.id !== tripId))
      
      if (elevatedTrips.length <= 1) {
        setIsOpen(false)
      }
    } catch (error) {
      console.error('Error rejecting trip:', error)
      throw error
    }
  }

  const handleViewTrip = (trip) => {
    setSelectedTrip(trip)
    setShowApprovalModal(true)
  }

  if (userRole !== 'admin' || elevatedTrips.length === 0) {
    return null
  }

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] bg-white rounded-lg shadow-lg z-50">
            <div className="flex items-center justify-between p-6 border-b bg-orange-50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                <div>
                  <h3 className="text-lg font-semibold">Trips Requiring Approval</h3>
                  <p className="text-sm text-gray-600">
                    {elevatedTrips.length} trip{elevatedTrips.length > 1 ? 's' : ''} need{elevatedTrips.length === 1 ? 's' : ''} your approval
                  </p>
                </div>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            
            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              {elevatedTrips.map((trip) => (
                <div key={trip.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Trip #{trip.trip_id || trip.id}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(trip.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600 mb-3">
                    <div><strong>Client:</strong> {trip.clientdetails?.name || 'N/A'}</div>
                    <div><strong>Route:</strong> {trip.origin} → {trip.destination}</div>
                    <div><strong>Total Cost:</strong> R{(trip.total_vehicle_cost || 0).toLocaleString()}</div>
                  </div>
                  
                  <Button 
                    onClick={() => handleViewTrip(trip)}
                    size="sm"
                    className="w-full"
                  >
                    Review & Approve
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 p-6 border-t">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                Review Later
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ElevationApprovalModal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false)
          setSelectedTrip(null)
        }}
        trip={selectedTrip}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </>
  )
}