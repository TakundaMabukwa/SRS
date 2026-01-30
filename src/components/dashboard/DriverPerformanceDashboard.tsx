'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trophy, TrendingUp, AlertTriangle, Star, Search, Calendar } from 'lucide-react'
import { type DriverPerformanceData } from '@/lib/actions/driver-performance'

export default function DriverPerformanceDashboard() {
  const [drivers] = useState<DriverPerformanceData[]>([
    { driverName: 'JOHANNES MPHAKA', plate: 'EXP-001', performanceLevel: 'Gold', currentPoints: 950, scores: { performanceRating: 95, insuranceRiskScore: 5, riskCategory: 'Low Risk', smoking: 98, harshBraking: 92, speeding: 96, fatigue: 94 }, violations: { total: 1, speed: 0, harshBraking: 1, nightDriving: 0 } },
    { driverName: 'ARTWELL', plate: 'EXP-002', performanceLevel: 'Gold', currentPoints: 920, scores: { performanceRating: 92, insuranceRiskScore: 8, riskCategory: 'Low Risk', smoking: 95, harshBraking: 88, speeding: 94, fatigue: 91 }, violations: { total: 2, speed: 1, harshBraking: 1, nightDriving: 0 } },
    { driverName: 'BANGANI MVELASE', plate: 'EXP-003', performanceLevel: 'Gold', currentPoints: 880, scores: { performanceRating: 88, insuranceRiskScore: 12, riskCategory: 'Low Risk', smoking: 90, harshBraking: 85, speeding: 89, fatigue: 88 }, violations: { total: 3, speed: 1, harshBraking: 2, nightDriving: 0 } },
    { driverName: 'BHEKI LAWU', plate: 'EXP-004', performanceLevel: 'Silver', currentPoints: 850, scores: { performanceRating: 85, insuranceRiskScore: 15, riskCategory: 'Low Risk', smoking: 88, harshBraking: 82, speeding: 86, fatigue: 84 }, violations: { total: 4, speed: 2, harshBraking: 2, nightDriving: 0 } },
    { driverName: 'BHEKI MDAKANE', plate: 'EXP-005', performanceLevel: 'Silver', currentPoints: 820, scores: { performanceRating: 82, insuranceRiskScore: 18, riskCategory: 'Low Risk', smoking: 85, harshBraking: 78, speeding: 83, fatigue: 81 }, violations: { total: 5, speed: 2, harshBraking: 3, nightDriving: 0 } },
    { driverName: 'BILLY MASEKO', plate: 'EXP-006', performanceLevel: 'Silver', currentPoints: 790, scores: { performanceRating: 79, insuranceRiskScore: 21, riskCategory: 'Low Risk', smoking: 82, harshBraking: 75, speeding: 80, fatigue: 78 }, violations: { total: 6, speed: 3, harshBraking: 3, nightDriving: 0 } },
    { driverName: 'BONGANI DAMLMINI', plate: 'EXP-007', performanceLevel: 'Silver', currentPoints: 760, scores: { performanceRating: 76, insuranceRiskScore: 24, riskCategory: 'Low Risk', smoking: 78, harshBraking: 72, speeding: 77, fatigue: 75 }, violations: { total: 7, speed: 3, harshBraking: 4, nightDriving: 0 } },
    { driverName: 'CHRISTOPHER HLONGWANE', plate: 'EXP-008', performanceLevel: 'Silver', currentPoints: 730, scores: { performanceRating: 73, insuranceRiskScore: 27, riskCategory: 'Low Risk', smoking: 75, harshBraking: 68, speeding: 74, fatigue: 72 }, violations: { total: 8, speed: 4, harshBraking: 4, nightDriving: 0 } },
    { driverName: 'CYRIL DU PLOOY', plate: 'EXP-009', performanceLevel: 'Bronze', currentPoints: 700, scores: { performanceRating: 70, insuranceRiskScore: 30, riskCategory: 'Medium Risk', smoking: 72, harshBraking: 65, speeding: 71, fatigue: 68 }, violations: { total: 9, speed: 4, harshBraking: 5, nightDriving: 0 } },
    { driverName: 'DALUVUYO MPHAFA', plate: 'EXP-010', performanceLevel: 'Bronze', currentPoints: 670, scores: { performanceRating: 67, insuranceRiskScore: 33, riskCategory: 'Medium Risk', smoking: 68, harshBraking: 62, speeding: 68, fatigue: 65 }, violations: { total: 10, speed: 5, harshBraking: 5, nightDriving: 0 } },
    { driverName: 'DAN NGWENYA', plate: 'EXP-011', performanceLevel: 'Bronze', currentPoints: 640, scores: { performanceRating: 64, insuranceRiskScore: 36, riskCategory: 'Medium Risk', smoking: 65, harshBraking: 58, speeding: 65, fatigue: 62 }, violations: { total: 11, speed: 5, harshBraking: 6, nightDriving: 0 } },
    { driverName: 'DANIEL MOISA', plate: 'EXP-012', performanceLevel: 'Bronze', currentPoints: 610, scores: { performanceRating: 61, insuranceRiskScore: 39, riskCategory: 'Medium Risk', smoking: 62, harshBraking: 55, speeding: 62, fatigue: 58 }, violations: { total: 12, speed: 6, harshBraking: 6, nightDriving: 0 } },
    { driverName: 'DONALD MOKOENA', plate: 'EXP-013', performanceLevel: 'Bronze', currentPoints: 580, scores: { performanceRating: 58, insuranceRiskScore: 42, riskCategory: 'Medium Risk', smoking: 58, harshBraking: 52, speeding: 59, fatigue: 55 }, violations: { total: 13, speed: 6, harshBraking: 7, nightDriving: 0 } },
    { driverName: 'ELLIOT MAKANDELA', plate: 'EXP-014', performanceLevel: 'Bronze', currentPoints: 550, scores: { performanceRating: 55, insuranceRiskScore: 45, riskCategory: 'High Risk', smoking: 55, harshBraking: 48, speeding: 56, fatigue: 52 }, violations: { total: 14, speed: 7, harshBraking: 7, nightDriving: 0 } },
    { driverName: 'EMMANUEL MDWANDWE', plate: 'EXP-015', performanceLevel: 'Bronze', currentPoints: 520, scores: { performanceRating: 52, insuranceRiskScore: 48, riskCategory: 'High Risk', smoking: 52, harshBraking: 45, speeding: 53, fatigue: 48 }, violations: { total: 15, speed: 7, harshBraking: 8, nightDriving: 0 } },
    { driverName: 'ERIC NTHULANI', plate: 'EXP-016', performanceLevel: 'Gold', currentPoints: 940, scores: { performanceRating: 94, insuranceRiskScore: 6, riskCategory: 'Low Risk', smoking: 96, harshBraking: 91, speeding: 95, fatigue: 93 }, violations: { total: 1, speed: 0, harshBraking: 1, nightDriving: 0 } },
    { driverName: 'EVIE MAZIBUKO', plate: 'EXP-017', performanceLevel: 'Gold', currentPoints: 910, scores: { performanceRating: 91, insuranceRiskScore: 9, riskCategory: 'Low Risk', smoking: 93, harshBraking: 87, speeding: 92, fatigue: 90 }, violations: { total: 2, speed: 1, harshBraking: 1, nightDriving: 0 } },
    { driverName: 'FREDDY NUCBE', plate: 'EXP-018', performanceLevel: 'Silver', currentPoints: 870, scores: { performanceRating: 87, insuranceRiskScore: 13, riskCategory: 'Low Risk', smoking: 89, harshBraking: 84, speeding: 88, fatigue: 86 }, violations: { total: 3, speed: 1, harshBraking: 2, nightDriving: 0 } },
    { driverName: 'FUNISWE SHEZI', plate: 'EXP-019', performanceLevel: 'Silver', currentPoints: 840, scores: { performanceRating: 84, insuranceRiskScore: 16, riskCategory: 'Low Risk', smoking: 86, harshBraking: 80, speeding: 85, fatigue: 83 }, violations: { total: 4, speed: 2, harshBraking: 2, nightDriving: 0 } },
    { driverName: 'GINGER KHOZA', plate: 'EXP-020', performanceLevel: 'Silver', currentPoints: 810, scores: { performanceRating: 81, insuranceRiskScore: 19, riskCategory: 'Low Risk', smoking: 83, harshBraking: 76, speeding: 82, fatigue: 80 }, violations: { total: 5, speed: 2, harshBraking: 3, nightDriving: 0 } },
    { driverName: 'GOODMAN NYOKA', plate: 'EXP-021', performanceLevel: 'Silver', currentPoints: 780, scores: { performanceRating: 78, insuranceRiskScore: 22, riskCategory: 'Low Risk', smoking: 80, harshBraking: 73, speeding: 79, fatigue: 77 }, violations: { total: 6, speed: 3, harshBraking: 3, nightDriving: 0 } },
    { driverName: 'ISAAC SIKHAKHANE', plate: 'EXP-022', performanceLevel: 'Silver', currentPoints: 750, scores: { performanceRating: 75, insuranceRiskScore: 25, riskCategory: 'Low Risk', smoking: 77, harshBraking: 70, speeding: 76, fatigue: 74 }, violations: { total: 7, speed: 3, harshBraking: 4, nightDriving: 0 } },
    { driverName: 'ISHMAEL MOHOJE', plate: 'EXP-023', performanceLevel: 'Bronze', currentPoints: 720, scores: { performanceRating: 72, insuranceRiskScore: 28, riskCategory: 'Medium Risk', smoking: 74, harshBraking: 67, speeding: 73, fatigue: 70 }, violations: { total: 8, speed: 4, harshBraking: 4, nightDriving: 0 } },
    { driverName: 'JABULANI NOMLANJA', plate: 'EXP-024', performanceLevel: 'Bronze', currentPoints: 690, scores: { performanceRating: 69, insuranceRiskScore: 31, riskCategory: 'Medium Risk', smoking: 70, harshBraking: 64, speeding: 70, fatigue: 67 }, violations: { total: 9, speed: 4, harshBraking: 5, nightDriving: 0 } },
    { driverName: 'JACK MOKOFANE', plate: 'EXP-025', performanceLevel: 'Bronze', currentPoints: 660, scores: { performanceRating: 66, insuranceRiskScore: 34, riskCategory: 'Medium Risk', smoking: 67, harshBraking: 60, speeding: 67, fatigue: 64 }, violations: { total: 10, speed: 5, harshBraking: 5, nightDriving: 0 } },
    { driverName: 'JOHANNES NHLAPO', plate: 'EXP-026', performanceLevel: 'Bronze', currentPoints: 630, scores: { performanceRating: 63, insuranceRiskScore: 37, riskCategory: 'Medium Risk', smoking: 64, harshBraking: 57, speeding: 64, fatigue: 60 }, violations: { total: 11, speed: 5, harshBraking: 6, nightDriving: 0 } },
    { driverName: 'JONAS PHANA TSOTSETSI', plate: 'EXP-027', performanceLevel: 'Bronze', currentPoints: 600, scores: { performanceRating: 60, insuranceRiskScore: 40, riskCategory: 'Medium Risk', smoking: 60, harshBraking: 54, speeding: 61, fatigue: 57 }, violations: { total: 12, speed: 6, harshBraking: 6, nightDriving: 0 } },
    { driverName: 'JOSEPH LEYNNA', plate: 'EXP-028', performanceLevel: 'Bronze', currentPoints: 570, scores: { performanceRating: 57, insuranceRiskScore: 43, riskCategory: 'Medium Risk', smoking: 57, harshBraking: 50, speeding: 58, fatigue: 54 }, violations: { total: 13, speed: 6, harshBraking: 7, nightDriving: 0 } },
    { driverName: 'JOSEPH ZWANE', plate: 'EXP-029', performanceLevel: 'Bronze', currentPoints: 540, scores: { performanceRating: 54, insuranceRiskScore: 46, riskCategory: 'High Risk', smoking: 54, harshBraking: 47, speeding: 55, fatigue: 50 }, violations: { total: 14, speed: 7, harshBraking: 7, nightDriving: 0 } },
    { driverName: 'JOSIEL MOFOKENG', plate: 'EXP-030', performanceLevel: 'Bronze', currentPoints: 510, scores: { performanceRating: 51, insuranceRiskScore: 49, riskCategory: 'High Risk', smoking: 50, harshBraking: 44, speeding: 52, fatigue: 47 }, violations: { total: 15, speed: 7, harshBraking: 8, nightDriving: 0 } }
  ])
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState('30')

  const filteredDrivers = Array.isArray(drivers) ? drivers.filter(driver =>
    driver.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (driver.plate && driver.plate.toLowerCase().includes(searchTerm.toLowerCase()))
  ) : []

  const getPerformanceLevelColor = (level: string) => {
    switch (level) {
      case 'Gold': return 'bg-yellow-100 text-yellow-800'
      case 'Silver': return 'bg-gray-100 text-gray-800'
      case 'Bronze': return 'bg-orange-100 text-orange-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Driver Performance Dashboard</h2>
          <p className="text-muted-foreground">Monitor driver performance metrics and reward levels</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {drivers.map((driver, index) => (
          <Card key={`${driver.driverName}-${index}`} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-semibold leading-tight break-words">{driver.driverName}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{driver.plate || 'No plate'}</p>
                </div>
                <Badge className={`${getPerformanceLevelColor(driver.performanceLevel)} text-xs px-2 py-1 shrink-0`}>
                  {driver.performanceLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-yellow-50 rounded-lg p-2">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Trophy className="h-3 w-3 text-yellow-600" />
                    <span className="text-xs font-medium">Points</span>
                  </div>
                  <span className="font-bold text-lg text-yellow-700">{driver.currentPoints}</span>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <div className="text-xs font-medium mb-1 text-blue-700">Rating</div>
                  <span className="font-bold text-lg text-blue-700">{driver.scores.performanceRating}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Performance</span>
                  <span className={getPerformanceColor(driver.scores.performanceRating)}>{driver.scores.performanceRating}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${driver.scores.performanceRating}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Risk Score</span>
                  <span className={getPerformanceColor(100 - driver.scores.insuranceRiskScore)}>{driver.scores.insuranceRiskScore}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
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

              {/* Behavior Scores */}
              <div className="space-y-1.5 pt-2 border-t">
                <div className="text-xs font-semibold mb-2">Behavior Scores</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">🚭 Smoking:</span>
                    <span className={getPerformanceColor(driver.scores.smoking || 0)}>{driver.scores.smoking}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">🚗 Speeding:</span>
                    <span className={getPerformanceColor(driver.scores.speeding || 0)}>{driver.scores.speeding}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">🛑 Braking:</span>
                    <span className={getPerformanceColor(driver.scores.harshBraking || 0)}>{driver.scores.harshBraking}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">😴 Fatigue:</span>
                    <span className={getPerformanceColor(driver.scores.fatigue || 0)}>{driver.scores.fatigue}%</span>
                  </div>
                </div>
              </div>

              {driver.violations.total > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      <span>Violations</span>
                    </div>
                    <Badge variant="destructive" className="text-xs px-1.5 py-0.5">{driver.violations.total}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Speed: {driver.violations.speed} | Braking: {driver.violations.harshBraking} | Night: {driver.violations.nightDriving}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {drivers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            No driver performance data available
          </div>
        </div>
      )}
    </div>
  )
}