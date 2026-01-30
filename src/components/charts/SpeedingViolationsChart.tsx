"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

export default function SpeedingViolationsChart() {
  const colors = ['#dc2626', '#ef4444', '#f97316', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf']
  
  const chartData = [
    { name: 'EMMANUEL MDWANDWE', value: 15, color: colors[0] },
    { name: 'ELLIOT MAKANDELA', value: 14, color: colors[1] },
    { name: 'JOSEPH ZWANE', value: 14, color: colors[2] },
    { name: 'DONALD MOKOENA', value: 13, color: colors[3] },
    { name: 'JOSEPH LEYNNA', value: 13, color: colors[4] },
    { name: 'DANIEL MOISA', value: 12, color: colors[5] },
    { name: 'JONAS PHANA', value: 12, color: colors[6] },
    { name: 'DAN NGWENYA', value: 11, color: colors[7] },
    { name: 'JOHANNES NHLAPO', value: 11, color: colors[8] },
    { name: 'DALUVUYO MPHAFA', value: 10, color: colors[9] }
  ]

  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card className="shadow-lg border-2 border-red-100">
      <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
        <CardTitle className="text-lg font-bold text-gray-800">Top 10 Speeding Violations</CardTitle>
        <p className="text-sm font-semibold text-red-600">Total incidents: {total}</p>
      </CardHeader>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, value }) => `${value}`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: 'none', 
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px' }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}