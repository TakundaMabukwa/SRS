import { useEffect, useRef, useState } from 'react'

interface WebSocketMessage {
  type: 'new-alert' | 'alert-status-changed' | 'alert-escalated' | 'screenshot-received' | 'unattended-alerts-reminder' | 'video-clip-ready'
  alert?: any
  image?: any
  unattendedAlerts?: any[]
  count?: number
}

const ALERT_HUB_BASE_URL =
  process.env.NEXT_PUBLIC_ALERT_HUB_BASE_URL ||
  process.env.NEXT_PUBLIC_VIDEO_BASE_URL
const ALERT_HUB_WS_URL =
  process.env.NEXT_PUBLIC_ALERT_HUB_WS_URL ||
  process.env.NEXT_PUBLIC_VIDEO_WS_URL

function getWsCandidates() {
  const out: string[] = []
  const seen = new Set<string>()
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:'

  const push = (base: string) => {
    const v = (base || '').trim().replace(/\/+$/, '')
    if (!v || seen.has(v)) return
    seen.add(v)
    out.push(v)
  }

  const rawWs = (ALERT_HUB_WS_URL || '').trim()
  if (rawWs) {
    try {
      const parsed = new URL(rawWs.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://'))
      push(`${rawWs.startsWith('wss://') ? 'wss' : 'ws'}://${parsed.host}`)
    } catch {
      push(rawWs.replace(/^https?:\/\//i, isHttpsPage ? 'wss://' : 'ws://'))
    }
  }

  if (ALERT_HUB_BASE_URL) {
    const cleaned = ALERT_HUB_BASE_URL
      .replace(/\/api\/video-server\/?$/i, '')
      .replace(/\/api\/?$/i, '')
      .replace(/\/+$/, '')
    try {
      const parsed = new URL(cleaned)
      const hostOnly = parsed.host
      if (hostOnly) {
        if (isHttpsPage) push(`wss://${hostOnly}`)
        push(`${parsed.protocol === 'https:' ? 'wss' : 'ws'}://${hostOnly}`)
        if (!isHttpsPage) push(`ws://${hostOnly}`)
      }
    } catch {
      if (isHttpsPage) push(cleaned.replace(/^https?:\/\//i, 'wss://'))
      if (!isHttpsPage) push(cleaned.replace(/^https?:\/\//i, 'ws://'))
    }
  }

  if (typeof window !== 'undefined' && !rawWs && !ALERT_HUB_BASE_URL) {
    const hostname = window.location.hostname
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
    if (!isLocal) {
      push(`${isHttpsPage ? 'wss' : 'ws'}://${window.location.host}`)
    }
  }

  return out.map((base) => `${base}/ws/alerts`)
}

export function useVideoWebSocket(onMessage?: (data: WebSocketMessage) => void) {
  const ws = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    let isActive = true
    const urls = getWsCandidates()
    let retryCount = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    if (!urls.length) {
      console.error('Alert hub base URL is not set. WebSocket disabled.')
      return
    }

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const scheduleReconnect = () => {
      if (!isActive) return
      clearReconnectTimer()
      const delayMs = Math.min(15000, 1000 * Math.pow(2, Math.min(retryCount, 4)))
      retryCount += 1
      reconnectTimer = setTimeout(() => {
        if (!isActive) return
        connect()
      }, delayMs)
    }

    const connect = () => {
      let idx = 0
      const tryNext = () => {
        if (!isActive) return
        const nextUrl = urls[idx++]
        if (!nextUrl) {
          scheduleReconnect()
          return
        }
        try {
          ws.current = new WebSocket(nextUrl)
        } catch {
          tryNext()
          return
        }

        const socket = ws.current

        socket.onopen = () => {
          if (!isActive || ws.current !== socket) return
          setConnected(true)
          retryCount = 0
          clearReconnectTimer()
          console.log('WebSocket connected')
        }

        socket.onmessage = (event) => {
          if (!isActive || ws.current !== socket) return
          try {
            const data = JSON.parse(event.data)
            setLastMessage(data)
            onMessageRef.current?.(data)
          } catch (err) {
            console.error('WebSocket message parse error:', err)
          }
        }

        socket.onerror = () => {
          // Silent error handling - will reconnect on close
        }

        socket.onclose = () => {
          if (ws.current === socket) {
            ws.current = null
          }
          if (!isActive) return
          setConnected(false)
          if (idx < urls.length) {
            tryNext()
            return
          }

          scheduleReconnect()
        }
      }

      try {
        tryNext()
      } catch (err) {
        console.error('WebSocket connection error:', err)
      }
    }

    connect()

    return () => {
      isActive = false
      clearReconnectTimer()
      const socket = ws.current
      ws.current = null
      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
        socket.close()
      }
    }
  }, [])

  return { connected, lastMessage }
}
