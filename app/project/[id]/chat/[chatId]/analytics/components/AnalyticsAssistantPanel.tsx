"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type UIEvent,
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { AssistantAnswerCard } from "./assistant/AssistantAnswerCard"
import type {
  AssistantAction,
  AssistantChatMessage,
  AssistantQueryResponse,
  DesignRankItem,
} from "@/lib/types/analyticsAssistant"
import { getBrand } from "@/lib/config/brand"

const brand = getBrand()

const ASSISTANT_WIDTH_STORAGE_KEY = "analytics-assistant-width"
const DEFAULT_PANEL_WIDTH = 420
const MIN_PANEL_WIDTH = 320
/** Keep at least this much analytics content visible while resizing. */
const MIN_MAIN_CONTENT_WIDTH = 280
/** Hard cap: assistant panel may not exceed 40% of the viewport. */
const MAX_PANEL_WIDTH_RATIO = 0.4
const NEAR_BOTTOM_PX = 80
const LOAD_OLDER_TOP_PX = 72

function clampPanelWidth(width: number, viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280) {
  const maxByRatio = Math.floor(viewportWidth * MAX_PANEL_WIDTH_RATIO)
  const max = Math.max(
    MIN_PANEL_WIDTH,
    Math.min(maxByRatio, viewportWidth - MIN_MAIN_CONTENT_WIDTH)
  )
  return Math.max(MIN_PANEL_WIDTH, Math.min(max, Math.round(width)))
}

function isMobileAssistantLayout() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches
}

interface TraceEntry {
  tool?: string
  args?: Record<string, unknown>
  status?: string
  error?: string
}

const TRACE_TOOL_LABELS: Record<string, string> = {
  rank_elements: "Ranked elements",
  rank_designs: "Ranked designs",
  compare_two: "Compared two sides",
  compare_all_segments: "Compared all segments",
  lookup_element_scores: "Looked up element scores",
  segment_base_sizes: "Read segment base sizes",
  classification_counts: "Counted classification answers",
  study_overview: "Read study overview",
  executive_summary: "Built executive summary",
  use_or_avoid_elements: "Split elements by significance",
  response_time_summary: "Read response times",
  fatigue_summary: "Checked respondent fatigue",
  explain_mindset: "Explained mindset",
  explain_design: "Explained design",
  list_saved_designs: "Listed saved designs",
}

/** Args worth surfacing, in the order they read most naturally. */
const TRACE_ARG_KEYS = [
  "segment_key",
  "segment_section",
  "metric",
  "direction",
  "limit",
  "mode",
  "left",
  "right",
  "must_include",
  "elements",
  "question",
  "options",
  "mindset_key",
] as const

function describeTraceEntry(entry: TraceEntry): string {
  const label = TRACE_TOOL_LABELS[entry.tool || ""] || entry.tool || "Calculation"
  const args = entry.args || {}
  const parts: string[] = []
  for (const key of TRACE_ARG_KEYS) {
    const value = args[key]
    if (value === undefined || value === null || value === "") continue
    if (Array.isArray(value)) {
      if (value.length) parts.push(value.join(", "))
    } else {
      parts.push(String(value))
    }
    if (parts.length >= 3) break
  }
  return parts.length ? `${label} — ${parts.join(" · ")}` : label
}

/**
 * Shows which verified calculations produced the answer. Only rendered for
 * agent-composed answers, which are the ones that can combine several lookups.
 */
function ComputationTrace({ usage }: { usage?: Record<string, unknown> }) {
  const trace = (usage?.trace as TraceEntry[] | undefined) || []
  if (!trace.length) return null

  const fellBack = usage?.grounding_fallback === true

  return (
    <details className="rounded-lg bg-white/70 px-2 py-1.5 text-[11px] text-gray-500">
      <summary className="cursor-pointer font-semibold">
        How this was computed ({trace.length} {trace.length === 1 ? "step" : "steps"})
      </summary>
      <ol className="mt-1 space-y-1">
        {trace.map((entry, idx) => (
          <li key={`${entry.tool}-${idx}`} className="flex gap-1.5">
            <span className="font-bold text-gray-700">{idx + 1}.</span>
            <span className={entry.error ? "text-rose-600" : undefined}>
              {describeTraceEntry(entry)}
              {entry.error ? " (skipped)" : ""}
            </span>
          </li>
        ))}
      </ol>
      {fellBack ? (
        <p className="mt-1.5 text-[10px] text-amber-700">
          The wording was replaced with the verified summary because a figure in the drafted
          answer could not be traced to these steps.
        </p>
      ) : null}
    </details>
  )
}

export function AnalyticsAssistantPanel({
  open,
  onOpenChange,
  messages,
  input,
  setInput,
  loading,
  historyLoading = false,
  loadingOlder = false,
  hasMoreOlder = false,
  showWelcome = false,
  error,
  starters,
  studyType,
  sendMessage,
  loadOlderMessages,
  retryLast,
  clearChat,
  runAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: AssistantChatMessage[]
  input: string
  setInput: (value: string) => void
  loading: boolean
  historyLoading?: boolean
  loadingOlder?: boolean
  hasMoreOlder?: boolean
  showWelcome?: boolean
  error: string | null
  starters: string[]
  studyType?: string
  sendMessage: (message: string) => void | Promise<void>
  loadOlderMessages?: () => Promise<boolean> | boolean | void
  retryLast: () => void
  clearChat: () => void | Promise<void>
  runAction: (action: AssistantAction, response?: AssistantQueryResponse) => void | Promise<void>
}) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const stickToBottomRef = useRef(true)
  const pendingPrependAdjustRef = useRef<{ prevHeight: number; prevTop: number } | null>(null)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [mobileViewport, setMobileViewport] = useState<{ top: number; height: number } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(ASSISTANT_WIDTH_STORAGE_KEY))
    if (Number.isFinite(saved)) {
      setPanelWidth(clampPanelWidth(saved))
    }
  }, [])

  useEffect(() => {
    const syncWidth = () => {
      setPanelWidth((current) => clampPanelWidth(current))
    }
    window.addEventListener("resize", syncWidth)
    return () => window.removeEventListener("resize", syncWidth)
  }, [])

  // Mobile: track visual viewport so the composer stays above the software keyboard.
  useEffect(() => {
    if (!open || !isMobileAssistantLayout()) {
      setMobileViewport(null)
      return
    }

    const viewport = window.visualViewport
    if (!viewport) return

    const syncViewport = () => {
      setMobileViewport({
        top: viewport.offsetTop,
        height: viewport.height,
      })
    }

    syncViewport()
    viewport.addEventListener("resize", syncViewport)
    viewport.addEventListener("scroll", syncViewport)
    return () => {
      viewport.removeEventListener("resize", syncViewport)
      viewport.removeEventListener("scroll", syncViewport)
      setMobileViewport(null)
    }
  }, [open])

  // Mobile: avoid background page scroll while the sheet is open.
  useEffect(() => {
    if (!open || !isMobileAssistantLayout()) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // Preserve scroll anchor after older messages are prepended.
  useEffect(() => {
    const node = listRef.current
    const pending = pendingPrependAdjustRef.current
    if (!node || !pending) return
    const delta = node.scrollHeight - pending.prevHeight
    node.scrollTop = pending.prevTop + delta
    pendingPrependAdjustRef.current = null
  }, [messages])

  // Auto-scroll only when the user is already near the bottom (or sending).
  useEffect(() => {
    if (!open) return
    const node = listRef.current
    if (!node) return
    if (pendingPrependAdjustRef.current) return
    if (stickToBottomRef.current) {
      node.scrollTop = node.scrollHeight
    }
  }, [messages, open, loading, historyLoading])

  // Desktop only — auto-focus on phones opens the keyboard and zooms the page.
  useEffect(() => {
    if (!open || isMobileAssistantLayout()) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) setConfirmClear(false)
  }, [open])

  const handleSubmit = () => {
    if (!input.trim() || loading) return
    stickToBottomRef.current = true
    void sendMessage(input)
  }

  const scrollInputIntoView = () => {
    if (!isMobileAssistantLayout()) return
    window.requestAnimationFrame(() => {
      inputRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
      if (listRef.current && stickToBottomRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    })
  }

  const maybeLoadOlder = useCallback(async () => {
    if (!loadOlderMessages || !hasMoreOlder || loadingOlder || historyLoading) return
    const node = listRef.current
    if (!node) return
    pendingPrependAdjustRef.current = {
      prevHeight: node.scrollHeight,
      prevTop: node.scrollTop,
    }
    const loaded = await loadOlderMessages()
    if (!loaded) {
      pendingPrependAdjustRef.current = null
    }
  }, [loadOlderMessages, hasMoreOlder, loadingOlder, historyLoading])

  const onListScroll = (event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    stickToBottomRef.current = distanceFromBottom < NEAR_BOTTOM_PX
    if (node.scrollTop <= LOAD_OLDER_TOP_PX) {
      void maybeLoadOlder()
    }
  }

  const mobilePanelStyle: CSSProperties | undefined =
    mobileViewport != null
      ? {
          top: mobileViewport.top,
          height: mobileViewport.height,
          bottom: "auto",
        }
      : undefined

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const move = (pointerEvent: PointerEvent) => {
      const next = clampPanelWidth(window.innerWidth - pointerEvent.clientX)
      setPanelWidth(next)
    }
    const stop = () => {
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", stop)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      setPanelWidth((current) => {
        const clamped = clampPanelWidth(current)
        window.localStorage.setItem(ASSISTANT_WIDTH_STORAGE_KEY, String(clamped))
        return clamped
      })
    }
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", stop)
  }

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setConfirmClear(false)
    stickToBottomRef.current = true
    void clearChat()
  }

  return (
    <>
      {/* Floating launcher — always visible, responsive */}
      {!open ? (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="fixed bottom-4 right-4 z-[102] inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#2674BA] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#2674BA]/30 transition hover:bg-[#2674BA]/90 active:scale-95 sm:bottom-6 sm:right-6"
          aria-label="Open analytics assistant"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask Analytics</span>
        </button>
      ) : null}

      {/* Mobile backdrop */}
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            aria-label="Close assistant backdrop"
            className="fixed inset-0 z-[102] cursor-pointer bg-black/30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-gray-200 bg-white shadow-2xl max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:right-0 max-lg:z-[103] max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:w-full max-lg:max-w-none lg:z-[102] lg:w-[var(--assistant-panel-width)] lg:max-w-[40vw] lg:shadow-none [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_summary]:cursor-pointer"
            aria-label="Verified analytics assistant"
            style={
              {
                "--assistant-panel-width": `${panelWidth}px`,
                ...mobilePanelStyle,
              } as CSSProperties
            }
          >
            <button
              type="button"
              onPointerDown={beginResize}
              className="absolute inset-y-0 -left-2 z-20 flex w-4 cursor-col-resize touch-none items-center justify-center max-lg:hidden"
              aria-label="Resize analytics assistant"
              title="Drag to resize"
            >
              <span className="h-24 w-1 rounded-full bg-gray-300 shadow-sm transition-colors group-hover:bg-[#2674BA] hover:bg-[#2674BA]" />
            </button>
            <button
              type="button"
              onPointerDown={beginResize}
              className="absolute inset-y-0 left-0 z-20 w-3 cursor-col-resize touch-none lg:hidden"
              aria-label="Resize analytics assistant"
              title="Drag to resize"
            />
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2674BA]/10 text-[#2674BA]">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{brand.aiName}</p>
                    <p className="truncate text-[11px] text-gray-500">
                      Private chat · {studyType || "study"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleClear}
                  className={`rounded-lg p-2 hover:bg-gray-100 ${
                    confirmClear ? "bg-rose-50 text-rose-600" : "text-gray-500"
                  }`}
                  title={confirmClear ? "Click again to clear your chat" : "Clear chat"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {confirmClear ? (
              <div className="flex items-center justify-between gap-2 border-b border-rose-100 bg-rose-50 px-4 py-2 text-[11px] text-rose-700">
                <span>Clear only your chat for this study?</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-md bg-white px-2 py-1 font-semibold ring-1 ring-rose-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            <div
              ref={listRef}
              onScroll={onListScroll}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
            >
              {historyLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className={`h-16 animate-pulse rounded-2xl ${
                        idx % 2 === 0 ? "ml-8 bg-gray-100" : "mr-8 bg-[#2674BA]/10"
                      }`}
                    />
                  ))}
                </div>
              ) : null}

              {!historyLoading && hasMoreOlder ? (
                <div className="flex justify-center py-1">
                  {loadingOlder ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading earlier messages…
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void maybeLoadOlder()}
                      className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#2674BA] ring-1 ring-[#2674BA]/20 hover:bg-[#2674BA]/5"
                    >
                      Load earlier messages
                    </button>
                  )}
                </div>
              ) : null}

              {!historyLoading && !hasMoreOlder && messages.length > 0 ? (
                <p className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  Beginning of conversation
                </p>
              ) : null}

              {showWelcome || (!historyLoading && messages.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-[#2674BA]/25 bg-[#2674BA]/5 p-4">
                  <p className="text-sm font-bold text-[#2674BA]">Ask anything about this study</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Ask in your own words — no set phrasing needed. Every number is read from the
                    verified analysis, never estimated, and you can check which calculations were
                    used under any answer. Your chat is private to you.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {starters.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          stickToBottomRef.current = true
                          void sendMessage(prompt)
                        }}
                        className="rounded-full border border-[#2674BA]/20 bg-white px-3 py-1.5 text-left text-[11px] font-semibold text-[#2674BA] hover:bg-[#2674BA]/5"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm sm:max-w-[92%] ${
                      message.role === "user"
                        ? "bg-[#2674BA] text-white"
                        : "border border-gray-100 bg-gray-50 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>

                    {message.status === "sending" && message.role === "user" ? (
                      <div className="mt-1 text-[10px] text-white/70">Sending…</div>
                    ) : null}

                    {message.pending ? (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Verifying with study data…
                      </div>
                    ) : null}

                    {message.error ? (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{message.error}</span>
                      </div>
                    ) : null}

                    {message.response ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {message.response.applied_context?.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          ) : null}
                          {message.response.applied_context?.metric ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                              {message.response.applied_context.metric}
                            </span>
                          ) : null}
                          {message.response.applied_context?.segment_label ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                              {message.response.applied_context.segment_label}
                            </span>
                          ) : null}
                          {message.response.applied_context?.base_size != null ? (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
                              n={message.response.applied_context.base_size}
                            </span>
                          ) : null}
                        </div>

                        {(message.response.blocks || []).map((block, idx) => (
                          <AssistantAnswerCard
                            key={`${message.id}-block-${idx}`}
                            block={block}
                            onOpenInConfigurator={(design: DesignRankItem, meta) => {
                              void runAction(
                                {
                                  type: "open_configurator",
                                  label: "Open in Design Configurator",
                                  payload: {
                                    view: "configurator",
                                    design,
                                    metric:
                                      meta?.metric ||
                                      message.response?.applied_context?.metric ||
                                      null,
                                    segment_label:
                                      message.response?.applied_context?.segment_label || null,
                                    background_url: meta?.background_url,
                                    aspect_ratio: meta?.aspect_ratio,
                                  },
                                },
                                message.response
                              )
                              // Close mobile fullscreen assistant so the configurator is visible.
                              if (isMobileAssistantLayout()) {
                                onOpenChange(false)
                              }
                            }}
                          />
                        ))}

                        {message.response.status === "needs_clarification" &&
                        message.response.clarification_options?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {message.response.clarification_options.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  stickToBottomRef.current = true
                                  void sendMessage(option)
                                }}
                                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#2674BA] ring-1 ring-[#2674BA]/25 hover:bg-[#2674BA]/5"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {message.response.actions?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {message.response.actions.map((action, idx) => {
                              const isFilter = action.type === "apply_filter"
                              return (
                                <button
                                  key={`${action.type}-${idx}`}
                                  type="button"
                                  onClick={() => void runAction(action, message.response)}
                                  className={
                                    isFilter
                                      ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                                      : "rounded-lg bg-[#2674BA] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1f5f99]"
                                  }
                                >
                                  {action.label}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}

                        {message.response.follow_ups?.length ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {message.response.follow_ups.map((followUp) => (
                              <button
                                key={followUp}
                                type="button"
                                onClick={() => {
                                  stickToBottomRef.current = true
                                  void sendMessage(followUp)
                                }}
                                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                              >
                                {followUp}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {message.response.evidence?.length ? (
                          <details className="rounded-lg bg-white/70 px-2 py-1.5 text-[11px] text-gray-500">
                            <summary className="cursor-pointer font-semibold">Evidence citations</summary>
                            <ul className="mt-1 space-y-1">
                              {message.response.evidence.map((fact) => (
                                <li key={fact.fact_id}>
                                  <span className="font-bold text-gray-700">[{fact.fact_id}]</span>{" "}
                                  {fact.label}
                                  {fact.value != null ? `: ${fact.value}` : ""}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}

                        <ComputationTrace usage={message.response.usage} />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {error ? (
              <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:mx-4">
                <span className="min-w-0 break-words">{error}</span>
                <button
                  type="button"
                  onClick={retryLast}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 font-semibold ring-1 ring-rose-200"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            ) : null}

            <div className="shrink-0 border-t border-gray-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-[#2674BA]/25">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={scrollInputIntoView}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  rows={2}
                  placeholder="Ask about elements, designs, classification counts…"
                  className="max-h-32 min-h-[56px] w-full resize-none bg-transparent px-2 py-1 text-base leading-snug text-gray-900 outline-none placeholder:text-gray-400 touch-manipulation lg:resize-y lg:text-sm"
                  disabled={loading}
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                />
                <div className="flex items-center justify-between gap-2 px-1 pb-1">
                  <p className="text-[10px] text-gray-400">Enter to send · Shift+Enter for newline</p>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || !input.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2674BA] px-3 py-2 text-xs font-bold text-white hover:bg-[#1f5f99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
                    Ask
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  )
}
