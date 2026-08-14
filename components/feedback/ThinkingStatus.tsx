"use client"

import { useEffect, useRef, useState } from "react"
import { Bot } from "lucide-react"

const DOT_MS = 400
const TYPE_MS = 58
const MAX_CHAR_MS = 96
const MIN_FILL_MS = 36000
const PAST_LINES = 5

function splitThoughts(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function sharedPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i] === b[i]) i += 1
  return i
}

type ThinkingStatusProps = {
  liveText?: string
  streamDone?: boolean
}

export function ThinkingStatus({
  liveText = "",
  streamDone = false,
}: ThinkingStatusProps) {
  const [dots, setDots] = useState(3)
  const [shown, setShown] = useState("")
  const targetRef = useRef(liveText)
  const streamDoneRef = useRef(streamDone)
  const shownRef = useRef("")
  targetRef.current = liveText
  streamDoneRef.current = streamDone

  useEffect(() => {
    const id = window.setInterval(() => {
      setDots((n) => (n >= 6 ? 1 : n + 1))
    }, DOT_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer = 0
    const started = Date.now()

    const tick = () => {
      if (cancelled) return
      const target = targetRef.current
      setShown((prev) => {
        let next = prev
        if (!target.startsWith(prev)) {
          const keep = sharedPrefix(prev, target)
          next = target.slice(0, Math.min(keep + 1, target.length))
        } else if (prev.length < target.length) {
          next = target.slice(0, prev.length + 1)
        } else {
          next = target
        }
        shownRef.current = next
        return next
      })

      const remaining = Math.max(0, target.length - shownRef.current.length)
      const elapsed = Date.now() - started
      let delay = TYPE_MS
      if (streamDoneRef.current && remaining > 0) {
        const stretch = Math.max(0, MIN_FILL_MS - elapsed) / remaining
        delay = Math.min(MAX_CHAR_MS, Math.max(TYPE_MS, stretch))
      }
      timer = window.setTimeout(tick, delay)
    }

    timer = window.setTimeout(tick, TYPE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  const lines = splitThoughts(shown)
  const past = lines.slice(0, -1).slice(-PAST_LINES)
  const current = lines.at(-1)

  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500">
        <Bot className="size-4 text-white" />
      </div>
      <div className="min-w-0 max-w-[min(100%,32rem)] flex-1 rounded-2xl bg-gray-100 px-4 py-3">
        <p className="font-medium tracking-tight text-gray-800">
          Thinking{".".repeat(dots)}
        </p>
        {current ? (
          <div className="mt-2 space-y-1.5 text-[13px] leading-5">
            {past.map((line, i) => (
              <p key={`${i}-${line}`} className="text-gray-400">
                {line}
              </p>
            ))}
            <p className="text-gray-700">
              {current}
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-gray-800 align-middle animate-pulse"
              />
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-gray-500">Reading your request</p>
        )}
      </div>
    </div>
  )
}
