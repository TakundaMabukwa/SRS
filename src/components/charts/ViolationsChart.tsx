"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, CartesianGrid } from 'recharts'

export default function ViolationsChart() {
  const chartData = [
    { name: 'Speed', value: 245, color: '#ef4444' },
    { name: 'Route', value: 128, color: '#f97316' },
    { name: 'Night', value: 89, color: '#8b5cf6' },
    { name: 'Harsh Braking', value: 167, color: '#ec4899' },
    { name: 'Fatigue', value: 52, color: '#f59e0b' }
  ]

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card className="shadow-lg border-2 border-blue-100">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
        <CardTitle className="text-lg font-bold text-gray-800">Violations Summary</CardTitle>
        <p className="text-sm font-semibold text-blue-600">Total: {total} violations</p>
      </CardHeader>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: 'none', 
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}