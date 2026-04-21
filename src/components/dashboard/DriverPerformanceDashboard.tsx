'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trophy, AlertTriangle, Search } from 'lucide-react'
import { type DriverPerformanceData } from '@/lib/actions/driver-performance'

type DriverStandingRow = {
  vehicle_id: string
  device_id: string | null
  display_name: string | null
  registration_number: string | null
  fleet_number: string | null
  violations: number
  current_points: number
  rating: number
  risk_score: number
  risk_category: string | null
  performance_level: string | null
  fatigue_score: number
  seatbelt_score: number
  lane_deviation_score: number
  possible_fatigue_score: number
  speeding_score: number
  fatigue_alerts: number
  seatbelt_alerts: number
  lane_deviation_alerts: number
  possible_fatigue_alerts: number
  speeding_alerts: number
  ncr_total: number
  ncr_open: number
  last_alert_at: string | null
}

type DriverStandingsResponse = {
  success?: boolean
  data?: DriverStandingRow[]
}

type BehaviorMetric = {
  label: string
  value: number
}

const getPerformanceLevelColor = (level: string) => {
  switch (level) {
    case 'Gold':
      return 'bg-yellow-100 text-yellow-800'
    case 'Silver':
      return 'bg-gray-100 text-gray-800'
    case 'Bronze':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

const getPerformanceColor = (score: number) => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const mapStandingToCard = (standing: DriverStandingRow): DriverPerformanceData => {
  const rating = toNumber(standing.rating, 100)
  const riskScore = toNumber(standing.risk_score)
  const fatigueScore = toNumber(standing.fatigue_score, 100)
  const seatbeltScore = toNumber(standing.seatbelt_score, 100)
  const laneDeviationScore = toNumber(standing.lane_deviation_score, 100)
  const possibleFatigueScore = toNumber(standing.possible_fatigue_score, 100)
  const speedingScore = toNumber(standing.speeding_score, 100)

  return {
    driverName:
      String(
        standing.display_name ||
          standing.registration_number ||
          standing.fleet_number ||
          standing.vehicle_id ||
          standing.device_id ||
          'Unknown Vehicle'
      ).trim(),
    plate: String(standing.registration_number || standing.fleet_number || standing.vehicle_id || '').trim() || null,
    currentPoints: toNumber(standing.current_points, 100),
    performanceLevel: String(standing.performance_level || 'Gold').trim(),
    scores: {
      performanceRating: rating,
      insuranceRiskScore: riskScore,
      riskCategory: String(standing.risk_category || 'Low Risk').trim(),
      fatigue: fatigueScore,
      seatbelt: seatbeltScore,
      laneDeviation: laneDeviationScore,
      possibleFatigue: possibleFatigueScore,
      speeding: speedingScore,
    },
    violations: {
      total: toNumber(standing.violations),
      speed: toNumber(standing.speeding_alerts),
      harshBraking: 0,
      nightDriving: 0,
      seatbelt: toNumber(standing.seatbelt_alerts),
      laneDeviation: toNumber(standing.lane_deviation_alerts),
      possibleFatigue: toNumber(standing.possible_fatigue_alerts),
      fatigue: toNumber(standing.fatigue_alerts),
      speeding: toNumber(standing.speeding_alerts),
    },
  }
}

const getBehaviorScores = (driver: DriverPerformanceData): BehaviorMetric[] => [
  { label: 'Fatigue', value: driver.scores.fatigue || 0 },
  { label: 'Seatbelt', value: driver.scores.seatbelt || 0 },
  { label: 'Lane Deviation', value: driver.scores.laneDeviation || 0 },
  { label: 'Possible Fatigue', value: driver.scores.possibleFatigue || 0 },
  { label: 'Speeding', value: driver.scores.speeding || 0 },
]

export default function DriverPerformanceDashboard() {
  const [drivers, setDrivers] = useState<DriverPerformanceData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState('mtd')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadDriverStandings = async () => {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch('/api/video-server/drivers/standings?limit=250', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const json = (await response.json()) as DriverStandingsResponse
        const rows = Array.isArray(json?.data) ? json.data : []
        const mapped = rows.map(mapStandingToCard)

        if (!cancelled) {
          setDrivers(mapped)
        }
      } catch (fetchError) {
        console.error('Failed to load driver standings:', fetchError)
        if (!cancelled) {
          setDrivers([])
          setError('Unable to load vehicle profiles right now')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDriverStandings()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredDrivers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return drivers

    return drivers.filter((driver) => {
      const driverName = String(driver.driverName || '').toLowerCase()
      const plate = String(driver.plate || '').toLowerCase()
      return driverName.includes(query) || plate.includes(query)
    })
  }, [drivers, searchTerm])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vehicle Performance Profiles</h2>
          <p className="text-muted-foreground">Current month standings based on alert activity and linked NCR readiness</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            <Input
              placeholder="Search registration or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 sm:w-64"
            />
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">Month to date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
          Loading vehicle profiles...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center text-red-700">
          {error}
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
          No vehicle profile data available
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDrivers.map((driver, index) => (
            <Card key={`${driver.driverName}-${driver.plate || index}`} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold leading-tight break-words">{driver.driverName}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{driver.plate || 'No registration'}</p>
                  </div>
                  <Badge className={`${getPerformanceLevelColor(driver.performanceLevel)} shrink-0 px-2 py-1 text-xs`}>
                    {driver.performanceLevel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-yellow-50 p-2">
                    <div className="mb-1 flex items-center justify-center gap-1">
                      <Trophy className="h-3 w-3 text-yellow-600" />
                      <span className="text-xs font-medium">Points</span>
                    </div>
                    <span className="text-lg font-bold text-yellow-700">{driver.currentPoints}</span>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2">
                    <div className="mb-1 text-xs font-medium text-blue-700">Rating</div>
                    <span className="text-lg font-bold text-blue-700">{driver.scores.performanceRating}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Performance</span>
                    <span className={getPerformanceColor(driver.scores.performanceRating)}>{driver.scores.performanceRating}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${driver.scores.performanceRating}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Risk Score</span>
                    <span className={getPerformanceColor(100 - driver.scores.insuranceRiskScore)}>{driver.scores.insuranceRiskScore}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className="h-1.5 rounded-full bg-green-500 transition-all duration-300"
                      style={{ width: `${Math.max(0, 100 - driver.scores.insuranceRiskScore)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium">Risk Category</div>
                  <Badge variant={driver.scores.riskCategory === 'Low Risk' ? 'default' : 'destructive'} className="text-xs">
                    {driver.scores.riskCategory}
                  </Badge>
                </div>

                <div className="space-y-1.5 border-t pt-2">
                  <div className="mb-2 text-xs font-semibold">Behavior Scores</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {getBehaviorScores(driver).map((metric) => (
                      <div key={metric.label} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{metric.label}:</span>
                        <span className={getPerformanceColor(metric.value)}>{metric.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      <span>Violations</span>
                    </div>
                    <Badge variant="destructive" className="px-1.5 py-0.5 text-xs">
                      {driver.violations.total}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
