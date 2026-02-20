import { useEffect, useRef, useState } from 'react'

interface WebSocketMessage {
  type: 'new-alert' | 'alert-status-changed' | 'alert-escalated' | 'screenshot-received' | 'unattended-alerts-reminder' | 'video-clip-ready'
  alert?: any
  image?: any
  unattendedAlerts?: any[]
  count?: number
}

const VIDEO_BASE_URL = process.env.NEXT_PUBLIC_VIDEO_BASE_URL
const VIDEO_WS_URL = process.env.NEXT_PUBLIC_VIDEO_WS_URL

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

  const rawWs = (VIDEO_WS_URL || '').trim()
  if (rawWs) {
    try {
      const parsed = new URL(rawWs.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://'))
      push(`${rawWs.startsWith('wss://') ? 'wss' : 'ws'}://${parsed.host}`)
    } catch {
      push(rawWs.replace(/^https?:\/\//i, isHttpsPage ? 'wss://' : 'ws://'))
    }
  }

  if (VIDEO_BASE_URL) {
    const cleaned = VIDEO_BASE_URL
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

  if (typeof window !== 'undefined' && !rawWs && !VIDEO_BASE_URL) {
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
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  useEffect(() => {
    const urls = getWsCandidates()
    if (!urls.length) {
      console.error('NEXT_PUBLIC_VIDEO_BASE_URL is not set. WebSocket disabled.')
      return
    }

    const connect = () => {
      let idx = 0
      const tryNext = () => {
        const nextUrl = urls[idx++]
        if (!nextUrl) {
          return
        }
        try {
          ws.current = new WebSocket(nextUrl)
        } catch {
          tryNext()
          return
        }

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
          if (idx < urls.length) {
            tryNext()
            return
          }
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
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
    }
  }, [onMessage])

  return { connected, lastMessage }
}
