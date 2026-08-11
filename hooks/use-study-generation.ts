"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  advanceStep,
  createJob,
  getJob,
  launchJob,
  updateStats,
  type LaunchMode,
  type StudyGenerationJob,
} from "@/lib/mock/study-generation"

const STEP_INTERVAL_MS = 2200
const STATS_TICK_MS = 1800

/**
 * Frontend-only study generation runner for a chat.
 * TODO(api): subscribe to job events instead of timers.
 */
export function useStudyGeneration(chatId: string, projectId: string) {
  const [job, setJob] = useState<StudyGenerationJob | null>(null)
  const advancingRef = useRef(false)

  useEffect(() => {
    setJob(getJob(chatId))
  }, [chatId])

  const startGeneration = useCallback(
    (title: string) => {
      const existing = getJob(chatId)
      if (existing && existing.phase !== "idle") {
        setJob(existing)
        return existing
      }
      const created = createJob(chatId, projectId, title)
      setJob(created)
      return created
    },
    [chatId, projectId]
  )

  // Auto-advance mocked generation steps
  useEffect(() => {
    if (!job || job.phase !== "generating") return
    if (advancingRef.current) return

    const timer = window.setTimeout(() => {
      advancingRef.current = true
      const next = advanceStep(job)
      setJob(next)
      advancingRef.current = false
    }, STEP_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [job])

  // Simulate response collection while live
  useEffect(() => {
    if (!job || job.phase !== "live") return

    const timer = window.setInterval(() => {
      const current = getJob(chatId)
      if (!current?.stats) return

      // Stop ticking once collection looks "filled" — avoids endless re-renders
      if (current.stats.completed >= 20) {
        window.clearInterval(timer)
        return
      }

      const completed = Math.min(20, current.stats.completed + 1)
      const inProgress = Math.max(0, 8 - Math.floor(completed / 5))
      const total = Math.max(completed + inProgress, current.stats.total + 1)
      const abandoned = current.stats.abandoned
      const completionRate =
        total > 0 ? Math.round((completed / total) * 1000) / 10 : 0
      const avgDurationSeconds = Math.min(90, 22 + Math.floor(completed * 0.8))

      setJob(
        updateStats(current, {
          total,
          inProgress,
          completed,
          abandoned,
          completionRate,
          avgDurationSeconds,
        })
      )
    }, STATS_TICK_MS)

    return () => window.clearInterval(timer)
  }, [job?.phase, chatId])

  const launch = useCallback(
    (mode: LaunchMode) => {
      const current = getJob(chatId)
      if (!current || current.phase !== "ready") return null
      const live = launchJob(current, mode)
      setJob(live)
      return live
    },
    [chatId]
  )

  const inputDisabled =
    job?.phase === "generating" || job?.phase === "ready"

  return {
    job,
    startGeneration,
    launch,
    inputDisabled,
  }
}
