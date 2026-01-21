import { useEffect, useRef, useState } from 'react'

interface WebSocketMessage {
  type: 'new-alert' | 'alert-status-changed' | 'alert-escalated' | 'screenshot-received' | 'unattended-alerts-reminder' | 'video-clip-ready'
  alert?: any
  image?: any
  unattendedAlerts?: any[]
  count?: number
}

const WS_URL = process.env.NEXT_PUBLIC_VIDEO_BASE_URL?.replace('http', 'ws') || 'ws://164.90.182.2:3000'

export function useVideoWebSocket(onMessage?: (data: WebSocketMessage) => void) {
  const ws = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const connect = () => {
      try {
        ws.current = new WebSocket(WS_URL)

        ws.current.onopen = () => {
          setConnected(true)
          console.log('WebSocket connected')
        }

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            setLastMessage(data)
            onMessage?.(data)
          } catch (err) {
            console.error('WebSocket message parse error:', err)
          }
        }

        ws.current.onerror = () => {
          // Silent error handling - will reconnect on close
        }

        ws.current.onclose = () => {
          setConnected(false)
          console.log('WebSocket disconnected, reconnecting in 5s...')
          reconnectTimeout.current = setTimeout(connect, 5000)
        }
      } catch (err) {
        console.error('WebSocket connection error:', err)
        reconnectTimeout.current = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
    }
  }, [onMessage])

  return { connected, lastMessage }
}
