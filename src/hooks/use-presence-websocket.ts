import { useEffect, useRef, useState } from "react"

function resolvePresenceWsUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_PRESENCE_WS_URL || "").trim()
  const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:"
  if (configured) {
    if (configured.startsWith("wss://") || configured.startsWith("ws://")) return configured
    const scheme = isHttpsPage ? "wss" : "ws"
    return `${scheme}://${configured.replace(/^[a-z]+:\/\//i, "")}`
  }
  const host = isHttpsPage ? "wss://209.38.252.70:3004" : "ws://209.38.252.70:3004"
  return host
}

export function usePresenceWebSocket(onMessage?: (data: any) => void) {
  const ws = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    let isActive = true
    let socket: WebSocket | null = null

    const clearTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const open = () => {
      if (!isActive) return
      clearTimer()
      let s: WebSocket
      try {
        s = new WebSocket(resolvePresenceWsUrl())
      } catch (e) {
        console.error("[PRESENCE] failed to create WS:", e)
        schedule()
        return
      }
      socket = s
      ws.current = s

      s.onopen = () => {
        if (isActive && ws.current === s) {
          setConnected(true)
          clearTimer()
          console.log("[PRESENCE] Presence WebSocket connected:", resolvePresenceWsUrl())
        }
      }

      s.onmessage = (event) => {
        if (!isActive || ws.current !== s) return
        try {
          const data = JSON.parse(event.data)
          onMessageRef.current?.(data)
        } catch (_) {}
      }

      s.onclose = () => {
        if (ws.current === s) ws.current = null
        if (!isActive) return
        setConnected(false)
        schedule()
      }

      s.onerror = (e) => {
        console.error("[PRESENCE] WS error:", e && e.message ? e.message : e)
      }
    }

    const schedule = () => {
      if (!isActive || reconnectTimerRef.current) return
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        open()
      }, 3000)
    }

    open()

    return () => {
      isActive = false
      clearTimer()
      const s = ws.current
      ws.current = null
      if (s) {
        s.onopen = null
        s.onmessage = null
        s.onerror = null
        s.onclose = null
        s.close()
      }
    }
  }, [])

  const send = (type: string, data?: Record<string, any>) => {
    const s = ws.current
    if (s && s.readyState === WebSocket.OPEN) {
      try {
        s.send(JSON.stringify({ type, data: data || {} }))
      } catch (_) {}
    }
  }

  return { connected, send }
}
