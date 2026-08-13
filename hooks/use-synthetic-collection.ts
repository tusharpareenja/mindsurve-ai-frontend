"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "@/lib/api/types"
import { syntheticCollectionApi } from "@/lib/api/syntheticCollection"
import { subscribeJobEvents } from "@/lib/ws/job-events"
import {
  mapResponseStats,
  type ResponseStats,
  type SyntheticCollectionRun,
  type SyntheticMode,
  type SyntheticStatus,
} from "@/types/synthetic-collection"

const ACTIVE: SyntheticStatus[] = ["queued", "running"]
/** REST poll only when WebSocket is unavailable — not while WS is live. */
const FALLBACK_POLL_MS = 5000

function startedTotal(completed: number, inProgress: number, abandoned: number) {
  return Math.max(0, completed) + Math.max(0, inProgress) + Math.max(0, abandoned)
}

export function useSyntheticCollection(chatId: string, enabled: boolean) {
  const [run, setRun] = useState<SyntheticCollectionRun | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const pollRef = useRef<number | null>(null)
  const wsLiveRef = useRef(false)

  const applyRun = useCallback((next: SyntheticCollectionRun) => {
    setRun(next)
    setError(next.status === "failed" ? next.error || next.message : null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const status = await syntheticCollectionApi.status(chatId)
      applyRun(status)
      return status
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setRun(null)
        return null
      }
      throw err
    }
  }, [applyRun, chatId])

  useEffect(() => {
    if (!enabled) {
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoaded(false)
    void (async () => {
      try {
        const status = await syntheticCollectionApi.status(chatId)
        if (!cancelled) applyRun(status)
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Couldn’t load collection status."
          )
        }
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyRun, chatId, enabled])

  const start = useCallback(
    async (mode: SyntheticMode) => {
      setStarting(true)
      setError(null)
      try {
        const res = await syntheticCollectionApi.start(chatId, {
          mode,
          randomize: mode === "randomize",
        })
        applyRun(res.run)
        return res
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "We couldn’t start synthetic collection."
        setError(message)
        throw err
      } finally {
        setStarting(false)
      }
    },
    [applyRun, chatId]
  )

  const retry = useCallback(async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await syntheticCollectionApi.retry(chatId, {
        mode: run?.mode ?? "ai",
        randomize: (run?.mode ?? "ai") === "randomize",
      })
      applyRun(res.run)
      return res
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Retry failed. Please try again."
      setError(message)
      throw err
    } finally {
      setStarting(false)
    }
  }, [applyRun, chatId, run?.mode])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startFallbackPolling = useCallback(() => {
    if (pollRef.current) return
    const tick = () => {
      // Never poll while the socket is healthy.
      if (wsLiveRef.current) {
        stopPolling()
        return
      }
      void refresh().catch(() => {
        /* keep trying */
      })
    }
    tick()
    pollRef.current = window.setInterval(tick, FALLBACK_POLL_MS)
  }, [refresh, stopPolling])

  const runId = run?.id
  const runStatus = run?.status
  const runWsUrl = run?.websocket_url

  useEffect(() => {
    if (!runId || !runStatus || !ACTIVE.includes(runStatus)) {
      stopPolling()
      wsLiveRef.current = false
      return
    }

    let stopped = false
    wsLiveRef.current = false

    const sub = subscribeJobEvents(runWsUrl, {
      onOpen: () => {
        if (stopped) return
        wsLiveRef.current = true
        // WebSocket is primary — stop any REST fallback polling.
        stopPolling()
      },
      onDisconnected: () => {
        if (stopped) return
        wsLiveRef.current = false
        startFallbackPolling()
      },
      onFallback: () => {
        if (stopped) return
        wsLiveRef.current = false
        startFallbackPolling()
      },
      onProgress: (progress, message) => {
        if (stopped) return
        setRun((prev) => {
          if (!prev) return prev
          const match = message?.match(/(\d+)\s*\/\s*(\d+)/)
          const completed = match
            ? Number(match[1])
            : prev.respondents_completed
          const requested = match
            ? Number(match[2])
            : prev.respondents_requested
          const abandoned = prev.stats.abandoned ?? 0
          // Job stream reports completed/N; treat one active worker as in-progress while running.
          const inProgress = completed < requested ? 1 : 0
          const total = startedTotal(completed, inProgress, abandoned)
          return {
            ...prev,
            progress: Math.max(prev.progress, Math.min(100, progress)),
            message: message || prev.message,
            status: "running",
            respondents_completed: Math.max(prev.respondents_completed, completed),
            respondents_requested: Math.max(prev.respondents_requested, requested),
            stats: {
              ...prev.stats,
              total,
              completed: Math.max(prev.stats.completed, completed),
              in_progress: inProgress,
              abandoned,
              completion_rate:
                total > 0
                  ? Math.round((completed / total) * 1000) / 10
                  : 0,
            },
          }
        })
      },
      onCompleted: () => {
        if (stopped) return
        // One final REST sync for analytics once the job finishes.
        void refresh()
      },
      onFailed: (errMsg) => {
        if (stopped) return
        setError(errMsg)
        void refresh()
      },
    })

    const fallbackTimer = window.setTimeout(() => {
      if (!stopped && !wsLiveRef.current) startFallbackPolling()
    }, 3000)

    return () => {
      stopped = true
      wsLiveRef.current = false
      window.clearTimeout(fallbackTimer)
      sub.stop()
      stopPolling()
    }
  }, [
    refresh,
    runId,
    runStatus,
    runWsUrl,
    startFallbackPolling,
    stopPolling,
  ])

  const stats: ResponseStats = mapResponseStats(run?.stats)
  const isActive = !!run && ACTIVE.includes(run.status)
  const isCompleted = run?.status === "completed"
  const isFailed = run?.status === "failed" || run?.status === "cancelled"

  return {
    run,
    stats,
    loaded,
    starting,
    error,
    isActive,
    isCompleted,
    isFailed,
    start,
    retry,
    refresh,
  }
}
