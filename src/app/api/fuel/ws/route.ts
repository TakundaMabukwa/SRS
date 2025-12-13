import { NextResponse } from 'next/server'
import WebSocket from 'ws'

export const dynamic = 'force-dynamic'

let cachedData: any[] = []
let ws: WebSocket | null = null
let lastUpdate = 0

function connectWebSocket() {
  if (ws?.readyState === WebSocket.OPEN) return
  
  const wsEndpoint = process.env.NEXT_PUBLIC_CAN_BUS_WEBSOCKET_ENDPOINT
  const key = process.env.NEXT_PUBLIC_CANBUS_KEY
  
  if (!wsEndpoint || !key) return
  
  ws = new WebSocket(`${wsEndpoint}?key=${key}`)
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString())
    if (message.type === 'snapshot') {
      cachedData = message.data
      lastUpdate = Date.now()
    } else if (message.type === 'update') {
      const index = cachedData.findIndex(v => v.plate === message.data.plate)
      if (index >= 0) {
        cachedData[index] = message.data
      } else {
        cachedData.push(message.data)
      }
      lastUpdate = Date.now()
    }
  })
  
  ws.on('close', () => {
    setTimeout(connectWebSocket, 5000)
  })
}

connectWebSocket()

export async function GET() {
  try {
    connectWebSocket()
    return NextResponse.json(cachedData)
  } catch (error) {
    console.error('Fuel WS proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch fuel data' }, { status: 500 })
  }
}
