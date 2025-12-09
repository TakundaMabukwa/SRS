"use client"

import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { ClientNameDisplay } from '@/components/ui/client-name-display'
import { RoutePreviewMap } from '@/components/ui/route-preview-map'

export function ElevationApprovalModal({ isOpen, onClose, trip, onApprove, onReject }) {
  const [loading, setLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  const handleApprove = async () => {
    setLoading(true)
    try {
      await onApprove(trip.id)
      onClose()
    } catch (error) {
      console.error('Approval failed:', error)
      alert('Failed to approve trip')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    
    setLoading(true)
    try {
      await onReject(trip.id, rejectionReason.trim())
      setRejectionReason('')
      onClose()
    } catch (error) {
      console.error('Rejection failed:', error)
      alert('Failed to reject trip')
    } finally {
      setLoading(false)
    }
  }

  if (!trip) return null

  const clientDetails = typeof trip.clientdetails === 'string' ? JSON.parse(trip.clientdetails) : trip.clientdetails
  const pickupLocs = trip.pickup_locations || trip.pickuplocations || []
  const dropoffLocs = trip.dropoff_locations || trip.dropofflocations || []
  const assignments = trip.vehicleassignments || trip.vehicle_assignments || []

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-white rounded-lg shadow-lg overflow-y-auto z-50">
          <div className="flex items-center justify-between p-6 border-b bg-orange-50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <div>
                <Dialog.Title className="text-xl font-semibold">Trip Elevation Approval</Dialog.Title>
                <p className="text-sm text-gray-600">Trip #{trip.trip_id || trip.id} requires your approval</p>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Trip Details - Read Only */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label>Client</Label>
                  <ClientNameDisplay 
                    selectedClient={clientDetails}
                    placeholder="No client selected"
                    readOnly
                  />
                </div>
                <div>
                  <Label>Commodity</Label>
                  <Input value={trip.cargo || ''} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <Label>Order Number</Label>
                  <Input value={trip.ordernumber || ''} readOnly className="bg-gray-50" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Rate</Label>
                  <Input value={trip.rate || ''} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <Label>Total Cost</Label>
                  <Input 
                    value={`R${(trip.total_vehicle_cost || 0).toLocaleString()}`} 
                    readOnly 
                    className="bg-red-50 font-semibold text-red-700" 
                  />
                </div>
                <div>
                  <Label>Trip Type</Label>
                  <Input value={trip.trip_type || 'local'} readOnly className="bg-gray-50" />
                </div>
              </div>
            </div>

            {/* Locations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Loading Location</Label>
                <Input value={trip.origin || ''} readOnly className="bg-gray-50" />
              </div>
              <div>
                <Label>Drop Off Point</Label>
                <Input value={trip.destination || ''} readOnly className="bg-gray-50" />
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Cost Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Fuel Cost:</span>
                  <p className="font-semibold">R{(trip.approximate_fuel_cost || 0).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Vehicle Cost:</span>
                  <p className="font-semibold">R{(trip.approximated_vehicle_cost || 0).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Driver Cost:</span>
                  <p className="font-semibold">R{(trip.approximated_driver_cost || 0).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Distance:</span>
                  <p className="font-semibold">{trip.estimated_distance || 0} km</p>
                </div>
              </div>
            </div>

            {/* Route Preview */}
            {trip.origin && trip.destination && (
              <div className="space-y-4">
                <h4 className="font-medium">Route Preview</h4>
                <RoutePreviewMap
                  origin={trip.origin}
                  destination={trip.destination}
                  routeData={null}
                  stopPoints={[]}
                  readOnly
                />
              </div>
            )}

            {/* Vehicle Assignments */}
            {assignments.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Vehicle Assignments</h4>
                {assignments.map((assignment, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Vehicle</Label>
                        <Input 
                          value={assignment.vehicle?.name || 'Not assigned'} 
                          readOnly 
                          className="bg-white" 
                        />
                      </div>
                      <div>
                        <Label>Driver(s)</Label>
                        <Input 
                          value={assignment.drivers?.map(d => d.name).filter(Boolean).join(', ') || 'Not assigned'} 
                          readOnly 
                          className="bg-white" 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rejection Reason */}
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason (if rejecting)</Label>
              <textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide reason for rejection..."
                className="w-full p-3 border rounded-lg resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 p-6 border-t bg-gray-50">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={loading}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {loading ? 'Rejecting...' : 'Reject'}
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {loading ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}