'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface CloseAlertModalProps {
  isOpen: boolean
  onClose: () => void
  alertId: string
  onSuccess: () => void
}

export default function CloseAlertModal({ isOpen, onClose, alertId, onSuccess }: CloseAlertModalProps) {
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (notes.trim().length < 10) {
      setError('Notes must be at least 10 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/video-server/alerts/${alertId}/resolve-with-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes.trim(),
          resolvedBy: 'Current User'
        })
      })

      const data = await response.json()

      if (data.success) {
        setNotes('')
        onSuccess()
        onClose()
      } else {
        setError(data.error || 'Failed to close alert')
      }
    } catch (err) {
      setError('Failed to close alert')
    }

    setLoading(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Close Alert</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Notes are <strong>required</strong> (minimum 10 characters)
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="notes">Resolution Notes *</Label>
            <Textarea
              id="notes"
              placeholder="Describe how the alert was resolved, actions taken, and any relevant details..."
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setError('')
              }}
              rows={5}
              className={error ? 'border-red-500' : ''}
            />
            <p className="text-sm text-gray-500">
              {notes.length} / 10 characters minimum
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || notes.trim().length < 10}>
            {loading ? 'Closing...' : 'Close Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
