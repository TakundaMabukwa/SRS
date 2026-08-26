'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trophy, AlertTriangle, Search, Star, RefreshCw } from 'lucide-react'

type DriverScore = {
  id: number
  fleet_number: string
  registration_number: string | null
  driver: string | null
  score: number
  alert_types: Array<{ alert_name: string; count: number }>
  created_at: string
  updated_at: string
}

export default function DriverPerformanceDashboard() {
  const [scores, setScores] = useState<DriverScore[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadScores = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/video-server/driver-scoring', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setScores(data?.scores || [])
      setError('')
    } catch (err) {
      console.error('Failed to load scores:', err)
      setError('Unable to load scores')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadScores()
  }, [loadScores])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return scores
    return scores.filter(s =>
      s.fleet_number?.toLowerCase().includes(q) ||
      s.driver?.toLowerCase().includes(q) ||
      s.registration_number?.toLowerCase().includes(q)
    )
  }, [scores, searchTerm])

  const summary = useMemo(() => {
    if (scores.length === 0) return { total: 0, avgScore: 0, highRisk: 0, lowRisk: 0 }
    const total = scores.length
    const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / total)
    const highRisk = scores.filter(s => s.score < 60).length
    const lowRisk = scores.filter(s => s.score >= 80).length
    return { total, avgScore, highRisk, lowRisk }
  }, [scores])

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-600'
    if (score >= 60) return 'from-yellow-500 to-amber-600'
    return 'from-red-500 to-rose-600'
  }

  const getScoreBorder = (score: number) => {
    if (score >= 80) return 'border-green-300 bg-green-50'
    if (score >= 60) return 'border-yellow-300 bg-yellow-50'
    return 'border-red-300 bg-red-50'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return { text: 'Good', color: 'bg-green-100 text-green-800' }
    if (score >= 60) return { text: 'Watch', color: 'bg-yellow-100 text-yellow-800' }
    return { text: 'At Risk', color: 'bg-red-100 text-red-800' }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        <span className="text-gray-500">Loading scores...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-600">{error}</p>
        <Button size="sm" className="mt-3" onClick={loadScores}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="text-sm text-blue-600 font-medium">Total Vehicles</div>
            <div className="text-2xl font-bold text-blue-900">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="text-sm text-purple-600 font-medium">Fleet Average</div>
            <div className="text-2xl font-bold text-purple-900">{summary.avgScore}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="text-sm text-green-600 font-medium">Good (80+)</div>
            <div className="text-2xl font-bold text-green-900">{summary.lowRisk}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-sm text-red-600 font-medium">At Risk (&lt;60)</div>
            <div className="text-2xl font-bold text-red-900">{summary.highRisk}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by fleet, driver, or registration..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" variant="outline" onClick={loadScores}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Vehicle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((s) => {
          const label = getScoreLabel(s.score)
          return (
            <Card key={s.fleet_number} className={`border-2 ${getScoreBorder(s.score)} hover:shadow-lg transition-all`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{s.fleet_number}</h3>
                    <p className="text-xs text-gray-500">{s.registration_number || 'N/A'}</p>
                  </div>
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getScoreColor(s.score)} flex items-center justify-center shadow-md`}>
                    <span className="text-white font-bold text-lg">{s.score}</span>
                  </div>
                </div>

                {s.driver && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">Driver:</span>
                    <span className="text-sm font-medium text-gray-800">{s.driver}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <Badge className={`text-xs ${label.color}`}>{label.text}</Badge>
                </div>

                {s.alert_types && s.alert_types.length > 0 && (
                  <div className="border-t pt-2 mt-2 space-y-1">
                    {s.alert_types.map((a, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-600 truncate">{a.alert_name}</span>
                        <Badge variant="outline" className="text-xs ml-2">{a.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            {searchTerm ? 'No vehicles match your search' : 'No vehicle scores found'}
          </div>
        )}
      </div>
    </div>
  )
}
