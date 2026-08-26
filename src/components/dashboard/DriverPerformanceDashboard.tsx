'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw, AlertTriangle } from 'lucide-react'

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

  useEffect(() => { loadScores() }, [loadScores])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return scores
    return scores.filter(s =>
      s.fleet_number?.toLowerCase().includes(q) ||
      s.driver?.toLowerCase().includes(q) ||
      s.registration_number?.toLowerCase().includes(q)
    )
  }, [scores, searchTerm])

  const getScoreLabel = (score: number) => {
    if (score >= 80) return { text: 'Good', color: 'bg-green-100 text-green-800 border-green-300' }
    if (score >= 60) return { text: 'Watch', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' }
    return { text: 'At Risk', color: 'bg-red-100 text-red-800 border-red-300' }
  }

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getAlertCategoryCounts = (alertTypes: Array<{ alert_name: string; count: number }>) => {
    const speeding = alertTypes.filter(a => /speed|overspeed/i.test(a.alert_name)).reduce((s, a) => s + a.count, 0)
    const harshBraking = alertTypes.filter(a => /brak/i.test(a.alert_name)).reduce((s, a) => s + a.count, 0)
    const zoneBreach = alertTypes.filter(a => /zone|fence|breach/i.test(a.alert_name)).reduce((s, a) => s + a.count, 0)
    const other = alertTypes.filter(a => !/speed|overspeed|brak|zone|fence|breach/i.test(a.alert_name)).reduce((s, a) => s + a.count, 0)
    return { speeding, harshBraking, zoneBreach, other }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" /><span className="text-gray-500">Loading scores...</span></div>
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
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by fleet, driver, or registration..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" variant="outline" onClick={loadScores}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filtered.map((s) => {
          const label = getScoreLabel(s.score)
          const cats = getAlertCategoryCounts(s.alert_types || [])
          return (
            <Card key={s.fleet_number} className="border border-gray-200 hover:shadow-md transition-all overflow-hidden">
              <CardContent className="p-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 text-sm truncate">{s.fleet_number}</h3>
                  <Badge className={`text-[10px] font-semibold px-1.5 py-0.5 ${label.color}`}>{label.text}</Badge>
                </div>

                {/* Score */}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-bold text-gray-900">{s.score}</span>
                  <span className="text-[10px] text-gray-400">/100</span>
                </div>

                {s.driver && <p className="text-[10px] text-gray-500 truncate mb-1">{s.driver}</p>}

                {/* Metrics */}
                <div className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Plate</span>
                    <span className="text-gray-600 truncate ml-1">{s.registration_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Speeding</span>
                    <span className={cats.speeding > 0 ? 'text-red-500' : 'text-green-500'}>{cats.speeding || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Braking</span>
                    <span className={cats.harshBraking > 0 ? 'text-red-500' : 'text-green-500'}>{cats.harshBraking || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Zone</span>
                    <span className={cats.zoneBreach > 0 ? 'text-red-500' : 'text-green-500'}>{cats.zoneBreach || '-'}</span>
                  </div>
                </div>

                {/* Score Bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div className={`h-1.5 rounded-full ${getBarColor(s.score)} transition-all`} style={{ width: `${Math.min(s.score, 100)}%` }} />
                </div>
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
