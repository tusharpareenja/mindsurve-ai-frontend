"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "@/lib/api/types"
import { taskGenerationApi } from "@/lib/api/taskGeneration"
import { subscribeJobEvents } from "@/lib/ws/job-events"
import type {
  GenerationRun,
  GenerationStatus,
  GenerationStep,
} from "@/types/task-generation"

const ACTIVE: GenerationStatus[] = ["queued", "generating", "saving"]
const POLL_MS = 2500

const STEP_DEFS: Omit<GenerationStep, "status">[] = [
  {
    id: "queued",
    label: "Queued for generation",
    description: "Your study brief is lined up with the task engine.",
  },
  {
    id: "matrix",
    label: "Building research matrix",
    description: "We’re structuring categories and elements into a fair design.",
  },
  {
    id: "combinations",
    label: "Balancing combinations",
    description: "MindGenomic exposure is being balanced across respondents.",
  },
  {
    id: "validating",
    label: "Validating task set",
    description: "Checking coverage so every element gets a fair chance.",
  },
  {
    id: "saving",
    label: "Saving study tasks",
    description: "Persisting the generated tasks to your draft study.",
  },
  {
    id: "ready",
    label: "Tasks ready",
    description: "Preview the study, then launch when you’re happy.",
  },
]

function activeStepIndex(progress: number, status: GenerationStatus): number {
  if (status === "ready" || status === "launched") return STEP_DEFS.length - 1
  if (status === "failed" || status === "cancelled") {
    return Math.min(
      STEP_DEFS.length - 2,
      Math.max(0, Math.floor(progress / 20))
    )
  }
  if (status === "queued" || progress < 8) return 0
  if (progress < 30) return 1
  if (progress < 55) return 2
  if (progress < 80) return 3
  if (progress < 98) return 4
  return 5
}

export function stepsForRun(run: GenerationRun | null): GenerationStep[] {
  if (!run) {
    return STEP_DEFS.map((s) => ({ ...s, status: "pending" as const }))
  }
  const activeIdx = activeStepIndex(run.progress, run.status)
  const done =
    run.status === "ready" || run.status === "launched"
  return STEP_DEFS.map((s, i) => ({
    ...s,
    status: done
      ? ("completed" as const)
      : i < activeIdx
        ? ("completed" as const)
        : i === activeIdx
          ? ("active" as const)
          : ("pending" as const),
  }))
}

export function useTaskGeneration(chatId: string, enabled: boolean) {
  const [run, setRun] = useState<GenerationRun | null>(null)
  const [starting, setStarting] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const runRef = useRef<GenerationRun | null>(null)
  const toastReadyRef = useRef<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const wsLiveRef = useRef(false)

  useEffect(() => {
    runRef.current = run
  }, [run])

  const applyRun = useCallback((next: GenerationRun) => {
    setRun((prev) => {
      if (!prev) return next
      // Keep progress monotonic while a job is active.
      if (
        ACTIVE.includes(next.status) &&
        ACTIVE.includes(prev.status) &&
        next.progress < prev.progress
      ) {
        return { ...next, progress: prev.progress }
      }
      return next
    })
    setError(next.status === "failed" ? next.error || next.message : null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const status = await taskGenerationApi.status(chatId)
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

  // Resume existing run when chat is already created.
  useEffect(() => {
    if (!enabled) {
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoaded(false)
    void (async () => {
      try {
        const status = await taskGenerationApi.status(chatId)
        if (!cancelled) applyRun(status)
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Couldn’t load task generation status."
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

  const start = useCallback(async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await taskGenerationApi.start(chatId)
      applyRun(res.run)
      return res
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "We couldn’t start task generation."
      setError(message)
      throw err
    } finally {
      setStarting(false)
    }
  }, [applyRun, chatId])

  const retry = useCallback(async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await taskGenerationApi.retry(chatId)
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
  }, [applyRun, chatId])

  const launch = useCallback(async () => {
    setLaunching(true)
    setError(null)
    try {
      const res = await taskGenerationApi.launch(chatId)
      applyRun(res.run)
      return res
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "We couldn’t launch the study."
      setError(message)
      throw err
    } finally {
      setLaunching(false)
    }
  }, [applyRun, chatId])

  const runId = run?.id
  const runStatus = run?.status
  const runWsUrl = run?.websocket_url
  const runJobId = run?.upstream_job_id

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    const tick = () => {
      void refresh().catch(() => {
        /* keep trying until the job finishes */
      })
    }
    tick()
    pollRef.current = window.setInterval(tick, POLL_MS)
  }, [refresh])

  // WebSocket is primary; REST polling is fallback only while disconnected.
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
        stopPolling()
      },
      onDisconnected: () => {
        if (stopped) return
        wsLiveRef.current = false
      },
      onFallback: () => {
        if (stopped || wsLiveRef.current) return
        startPolling()
      },
      onProgress: (progress, message) => {
        if (stopped) return
        setRun((prev) =>
          prev
            ? {
                ...prev,
                progress: Math.max(prev.progress, Math.min(100, progress)),
                message: message || prev.message,
                status:
                  progress >= 90
                    ? "saving"
                    : progress > 0
                      ? "generating"
                      : prev.status,
              }
            : prev
        )
      },
      onCompleted: (message) => {
        if (stopped) return
        stopPolling()
        void refresh()
        if (message) {
          setRun((prev) =>
            prev
              ? {
                  ...prev,
                  status: "ready",
                  progress: 100,
                  message:
                    message ||
                    "Tasks are ready. Preview your study, then launch when you’re happy.",
                }
              : prev
          )
        }
      },
      onFailed: (errMsg) => {
        if (stopped) return
        stopPolling()
        setError(errMsg)
        void refresh()
      },
    })

    // If the socket never opens, fall back to polling after a short wait.
    const fallbackTimer = window.setTimeout(() => {
      if (!stopped && !wsLiveRef.current) startPolling()
    }, 4000)

    return () => {
      stopped = true
      wsLiveRef.current = false
      window.clearTimeout(fallbackTimer)
      sub.stop()
      stopPolling()
    }
  }, [refresh, runId, runStatus, runWsUrl, runJobId, startPolling, stopPolling])

  const isActive = !!run && ACTIVE.includes(run.status)
  const isReady = run?.status === "ready"
  const isLaunched = run?.status === "launched" || run?.study_status === "active"
  const isFailed = run?.status === "failed" || run?.status === "cancelled"
  const steps = stepsForRun(run)

  return {
    run,
    steps,
    loaded,
    starting,
    launching,
    error,
    isActive,
    isReady,
    isLaunched,
    isFailed,
    start,
    retry,
    launch,
    refresh,
    applyRun,
    toastReadyRef,
  }
}
