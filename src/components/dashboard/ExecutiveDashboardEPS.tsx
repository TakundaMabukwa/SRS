'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import FleetRiskGauge from '@/components/charts/FleetFuelGauge'
import { RefreshCw, TrendingUp, AlertTriangle, Users, Award, Activity } from 'lucide-react'

export default function ExecutiveDashboardEPS() {
  const [lastUpdated] = useState(new Date())

  const leaderboard = [
    { driverName: 'JOHANNES MPHAKA', currentPoints: 950, totalEarned: 1850, performanceScore: 95, violations: 1, speedingIncidents: 0, totalKilometers: 12500 },
    { driverName: 'ERIC NTHULANI', currentPoints: 940, totalEarned: 1820, performanceScore: 94, violations: 1, speedingIncidents: 0, totalKilometers: 12200 },
    { driverName: 'ARTWELL', currentPoints: 920, totalEarned: 1780, performanceScore: 92, violations: 2, speedingIncidents: 1, totalKilometers: 11800 },
    { driverName: 'EVIE MAZIBUKO', currentPoints: 910, totalEarned: 1750, performanceScore: 91, violations: 2, speedingIncidents: 1, totalKilometers: 11500 },
    { driverName: 'BANGANI MVELASE', currentPoints: 880, totalEarned: 1680, performanceScore: 88, violations: 3, speedingIncidents: 1, totalKilometers: 11200 },
    { driverName: 'FREDDY NUCBE', currentPoints: 870, totalEarned: 1650, performanceScore: 87, violations: 3, speedingIncidents: 1, totalKilometers: 10900 },
    { driverName: 'BHEKI LAWU', currentPoints: 850, totalEarned: 1600, performanceScore: 85, violations: 4, speedingIncidents: 2, totalKilometers: 10600 },
    { driverName: 'FUNISWE SHEZI', currentPoints: 840, totalEarned: 1580, performanceScore: 84, violations: 4, speedingIncidents: 2, totalKilometers: 10400 }
  ]

  const riskAssessment = [
    { driver_name: 'EMMANUEL MDWANDWE', risk_category: 'High Risk', risk_score: 48, total_violations: 15 },
    { driver_name: 'ELLIOT MAKANDELA', risk_category: 'High Risk', risk_score: 45, total_violations: 14 },
    { driver_name: 'JOSEPH ZWANE', risk_category: 'High Risk', risk_score: 46, total_violations: 14 },
    { driver_name: 'DONALD MOKOENA', risk_category: 'Medium Risk', risk_score: 42, total_violations: 13 },
    { driver_name: 'JOSEPH LEYNNA', risk_category: 'Medium Risk', risk_score: 43, total_violations: 13 },
    { driver_name: 'DANIEL MOISA', risk_category: 'Medium Risk', risk_score: 39, total_violations: 12 },
    { driver_name: 'JONAS PHANA', risk_category: 'Medium Risk', risk_score: 40, total_violations: 12 },
    { driver_name: 'DAN NGWENYA', risk_category: 'Medium Risk', risk_score: 36, total_violations: 11 },
    { driver_name: 'JOHANNES NHLAPO', risk_category: 'Medium Risk', risk_score: 37, total_violations: 11 },
    { driver_name: 'DALUVUYO MPHAFA', risk_category: 'Medium Risk', risk_score: 33, total_violations: 10 }
  ]

  const monthlyData = [
    { month: 'Jan 2026', speedViolations: 167, routeViolations: 89, nightViolations: 58, activeVehicles: 30, kilometers: 312000 }
  ]

  const totalDrivers = 30
  const highRiskDrivers = riskAssessment.filter(d => d.risk_category === 'High Risk').length
  const totalPoints = leaderboard.reduce((sum, l) => sum + l.currentPoints, 0)
  const totalKilometers = leaderboard.reduce((sum, d) => sum + d.totalKilometers, 0)
  const totalViolations = 681

  return (
    <div className="space-y-8">
      <div className="bg-white shadow-md p-6 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl text-gray-800">EPS Courier Services</h1>
            <p className="text-sm text-gray-600 mt-1">Executive Dashboard - Fleet Analytics</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Last updated</p>
              <p className="text-sm font-semibold text-gray-700">{lastUpdated.toLocaleTimeString()}</p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Drivers</p>
                <p className="text-2xl font-bold text-gray-900">{totalDrivers}</p>
                <p className="text-xs text-gray-500 mt-1">All Active</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Risk</p>
                <p className="text-2xl font-bold text-gray-900">{highRiskDrivers}</p>
                <p className="text-xs text-gray-500 mt-1">Needs Action</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Vehicles</p>
                <p className="text-2xl font-bold text-gray-900">30</p>
                <p className="text-xs text-gray-500 mt-1">100% Online</p>
              </div>
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Points</p>
                <p className="text-2xl font-bold text-gray-900">{totalPoints.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Rewards</p>
              </div>
              <Award className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Violations</p>
                <p className="text-2xl font-bold text-gray-900">{totalViolations}</p>
                <p className="text-xs text-gray-500 mt-1">-15% MTD</p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Charts */}
      <div className="space-y-8">
        {/* Driver Rewards Leaderboard */}
        <Card className="border border-gray-200">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-lg font-semibold text-gray-800">Driver Rewards Leaderboard</CardTitle>
            <p className="text-sm text-gray-600">Top performing drivers by points earned</p>
          </CardHeader>
          <CardContent className="h-96 pt-6">
            <BarChart
              xAxis={[{
                scaleType: 'band',
                data: leaderboard.map(d => d.driverName)
              }]}
              series={[
                {
                  data: leaderboard.map(d => d.currentPoints),
                  label: 'Current Points',
                  color: '#6b7280'
                },
                {
                  data: leaderboard.map(d => d.totalEarned),
                  label: 'Total Earned',
                  color: '#9ca3af'
                }
              ]}
              width={900}
              height={350}
            />
          </CardContent>
        </Card>

        {/* Monthly Trend - Jan 2026 Only */}
        <Card className="border border-gray-200">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-lg font-semibold text-gray-800">January 2026 Violations Summary</CardTitle>
            <p className="text-sm text-gray-600">Current month performance metrics</p>
          </CardHeader>
          <CardContent className="h-96 pt-6">
            <BarChart
              xAxis={[{
                scaleType: 'band',
                data: ['Speed Violations', 'Route Violations', 'Night Violations']
              }]}
              series={[{
                data: [monthlyData[0].speedViolations, monthlyData[0].routeViolations, monthlyData[0].nightViolations],
                label: 'January 2026',
                color: '#4b5563'
              }]}
              width={900}
              height={350}
            />
          </CardContent>
        </Card>

        {/* Driver Performance Scores */}
        <Card className="border border-gray-200">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-lg font-semibold text-gray-800">Driver Performance Scores</CardTitle>
            <p className="text-sm text-gray-600">Excellence in driving behavior</p>
          </CardHeader>
          <CardContent className="h-96 pt-6">
            <BarChart
              xAxis={[{
                scaleType: 'band',
                data: leaderboard.map(d => d.driverName)
              }]}
              series={[{
                data: leaderboard.map(d => d.performanceScore),
                color: '#374151'
              }]}
              width={900}
              height={350}
            />
          </CardContent>
        </Card>

        {/* Risk Assessment and Violations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <FleetRiskGauge />

          <Card className="border border-gray-200">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-lg font-semibold text-gray-800">Driver Violations Overview</CardTitle>
              <p className="text-sm text-gray-600">Total incidents by driver</p>
            </CardHeader>
            <CardContent className="h-80 pt-6">
              <BarChart
                xAxis={[{
                  scaleType: 'band',
                  data: leaderboard.slice(0, 6).map(d => d.driverName.split(' ')[0])
                }]}
                series={[{
                  data: leaderboard.slice(0, 6).map(d => d.violations + d.speedingIncidents),
                  color: '#6b7280'
                }]}
                width={450}
                height={300}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Risk Assessment Table */}
      <Card className="border border-gray-200">
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="text-lg font-semibold text-gray-800">Driver Risk Assessment</CardTitle>
          <p className="text-sm text-gray-600">Comprehensive risk analysis and monitoring</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-semibold">Driver</th>
                  <th className="text-left p-3 font-semibold">Risk Category</th>
                  <th className="text-left p-3 font-semibold">Score</th>
                  <th className="text-left p-3 font-semibold">Violations</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {riskAssessment.map((driver, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{driver.driver_name}</td>
                    <td className="p-3">
                      <Badge 
                        className={`${
                          driver.risk_category === 'High Risk' ? 'bg-gray-700' : 
                          driver.risk_category === 'Medium Risk' ? 'bg-gray-500' : 
                          'bg-gray-400'
                        } text-white`}
                      >
                        {driver.risk_category}
                      </Badge>
                    </td>
                    <td className="p-3 font-semibold">{driver.risk_score}</td>
                    <td className="p-3">
                      <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded font-medium">
                        {driver.total_violations}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-gray-600">
                        {driver.risk_category === 'High Risk' ? 'Requires Action' :
                         driver.risk_category === 'Medium Risk' ? 'Monitor' : 'Good Standing'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Statistics Table */}
      <Card className="border border-gray-200">
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="text-lg font-semibold text-gray-800">January 2026 Fleet Statistics</CardTitle>
          <p className="text-sm text-gray-600">Current month performance overview</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-3 text-left font-semibold">Metric</th>
                  <th className="border border-gray-300 p-3 text-center font-semibold">Jan 2026</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3 font-medium">Speed Violations</td>
                  <td className="border border-gray-300 p-3 text-center font-semibold">{monthlyData[0].speedViolations}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3 font-medium">Route Violations</td>
                  <td className="border border-gray-300 p-3 text-center font-semibold">{monthlyData[0].routeViolations}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3 font-medium">Night Violations</td>
                  <td className="border border-gray-300 p-3 text-center font-semibold">{monthlyData[0].nightViolations}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3 font-medium">Active Vehicles</td>
                  <td className="border border-gray-300 p-3 text-center font-semibold">{monthlyData[0].activeVehicles}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-3 font-medium">Total Kilometres</td>
                  <td className="border border-gray-300 p-3 text-center font-semibold">{monthlyData[0].kilometers.toLocaleString()}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3 font-semibold">Total Violations</td>
                  <td className="border border-gray-300 p-3 text-center font-bold">
                    {monthlyData[0].speedViolations + monthlyData[0].routeViolations + monthlyData[0].nightViolations}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}