'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, FileText, Calendar } from 'lucide-react'
import { NCRTemplate } from '@/components/reports/ncr-template'
import { createRoot } from 'react-dom/client'

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [ncrs, setNcrs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchNCRs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      
      const res = await fetch(`/api/ncr/generate?${params}`)
      const data = await res.json()
      if (data.success) {
        setNcrs(data.ncrs || [])
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const downloadNCR = async (ncr: any) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NCR ${ncr.ncr_id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <div class="no-print p-4 text-center">
            <button onclick="window.print()" class="px-4 py-2 bg-blue-600 text-white rounded">Print / Save as PDF</button>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()

    setTimeout(() => {
      const root = createRoot(printWindow.document.getElementById('root')!)
      root.render(<NCRTemplate data={ncr.ncr_data} />)
    }, 500)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and download NCR reports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filter Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date From</Label>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>Date To</Label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={fetchNCRs} disabled={loading}>
            <FileText className="w-4 h-4 mr-2" />
            {loading ? 'Loading...' : 'Fetch NCR Reports'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NCR Reports ({ncrs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ncrs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No reports found</p>
          ) : (
            <div className="space-y-2">
              {ncrs.map((ncr) => (
                <div key={ncr.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                  <div>
                    <p className="font-semibold">{ncr.ncr_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {ncr.ncr_data.driverName} - {ncr.ncr_data.fleetNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ncr.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button onClick={() => downloadNCR(ncr)} size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
