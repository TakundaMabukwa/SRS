"use client"

import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, AlertTriangle } from 'lucide-react'

export function ElevationModal({ isOpen, onClose, onElevate }) {
  const [elevateToUser, setElevateToUser] = useState('')
  const [loading, setLoading] = useState(false)

  const handleElevate = async () => {
    if (!elevateToUser.trim()) {
      alert('Please enter a user to elevate to')
      return
    }

    setLoading(true)
    try {
      await onElevate(elevateToUser.trim())
      setElevateToUser('')
      onClose()
    } catch (error) {
      console.error('Elevation failed:', error)
      alert('Failed to elevate trip')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <Dialog.Title className="text-lg font-semibold">Elevate Trip</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              This trip requires elevation to a higher authority for approval.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="elevateToUser">Elevate to User</Label>
              <Input
                id="elevateToUser"
                value={elevateToUser}
                onChange={(e) => setElevateToUser(e.target.value)}
                placeholder="Enter username or email"
              />
            </div>
          </div>

          <div className="flex gap-2 p-6 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleElevate} disabled={loading} className="flex-1">
              {loading ? 'Elevating...' : 'Elevate Trip'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}