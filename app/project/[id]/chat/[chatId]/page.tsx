"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Send,
  Plus,
  Bot,
  User,
  ArrowLeft,
  Sparkles,
  PanelRightOpen,
  Paperclip,
  Loader2,
  X,
  FolderOpen,
  ImagePlus,
  FileText,
  Check,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { AppShell } from "@/components/layout/AppShell"
import { AuthGate } from "@/components/auth/AuthGate"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/feedback/Skeleton"
import { ThinkingStatus } from "@/components/feedback/ThinkingStatus"
import { StudyBriefCard } from "@/components/studies/StudyBriefCard"
import { StudyGenerationCard } from "@/components/studies/StudyGenerationCard"
import {
  PendingRegenerationCard,
  type PendingPreview,
} from "@/components/studies/PendingRegenerationCard"
import { StudyReadyCard } from "@/components/studies/StudyReadyCard"
import { CollectionChoiceCard, type CollectionMode } from "@/components/studies/CollectionChoiceCard"
import { RegenerateWarningDialog } from "@/components/studies/RegenerateWarningDialog"
import { useProjects } from "@/context/ProjectsContext"
import { useChats } from "@/context/ChatsContext"
import { useToast } from "@/components/feedback/Toaster"
import { useTaskGeneration } from "@/hooks/use-task-generation"
import { useSyntheticCollection } from "@/hooks/use-synthetic-collection"
import { useSpeechToText } from "@/hooks/use-speech-to-text"
import { SpeechToTextButton } from "@/components/chat/SpeechToTextButton"
import { ApiError } from "@/lib/api/types"
import type { SyntheticMode } from "@/types/synthetic-collection"
import { mapAiTurn, studyBriefApi } from "@/lib/api/studyBrief"
import { taskGenerationApi } from "@/lib/api/taskGeneration"
import {
  displayNameForUpload,
  mapPool,
  parseUploadSelection,
  type UploadItem,
} from "@/lib/chat-uploads"
import type { ChatMessage } from "@/types"
import type {
  AttachmentBrief,
  BriefPhase,
  BriefVersion,
  StudyBrief,
} from "@/types/study-brief"

const MAX_ATTACHMENTS = 40
const UPLOAD_CONCURRENCY = 4
const PANEL_STORAGE_KEY = "mindsurve.study-panel-width"
const PANEL_DEFAULT = 640
const PANEL_MIN = 400
const PANEL_MAX = 960

type ProposalStatus = "applied" | "discarded"

const proposalStorageKey = (chatId: string) =>
  `mindsurve.regeneration-proposals.${chatId}`

function readResolvedProposals(chatId: string): Record<string, ProposalStatus> {
  try {
    const raw = window.localStorage.getItem(proposalStorageKey(chatId))
    return raw ? (JSON.parse(raw) as Record<string, ProposalStatus>) : {}
  } catch {
    return {}
  }
}

export default function ChatPage() {
  const params = useParams()
  const projectId = params.id as string
  const chatId = params.chatId as string

  return (
    <AuthGate requireAuth>
      <ChatPageInner key={`${projectId}:${chatId}`} />
    </AuthGate>
  )
}

function ChatPageInner() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const chatId = params.chatId as string

  const {
    getProject,
    isLoading: projectsLoading,
    refresh: refreshProjects,
  } = useProjects()
  const {
    getChatsForProject,
    renameChat,
    loadMessages,
    isLoading: chatsLoading,
    refresh: refreshChats,
  } = useChats()

  const { toast } = useToast()

  const [draft, setDraft] = useState("")
  const [thinkingLive, setThinkingLive] = useState("")
  const [thoughtsStreamDone, setThoughtsStreamDone] = useState(false)
  const thinkAbortRef = useRef<AbortController | null>(null)
  const [briefVersions, setBriefVersions] = useState<BriefVersion[]>([])
  const [viewingVersion, setViewingVersion] = useState(0)
  const [restoringVersion, setRestoringVersion] = useState(false)
  const speech = useSpeechToText({
    onTranscript: setDraft,
    onError: (_error, message) => {
      toast({
        type: "error",
        title: "Couldn't use microphone",
        description: message,
      })
    },
  })
  const [sending, setSending] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [brief, setBrief] = useState<StudyBrief | null>(null)
  const [phase, setPhase] = useState<BriefPhase>("gathering")
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [nextBefore, setNextBefore] = useState<string | undefined>()
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [editRequestId, setEditRequestId] = useState(0)
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenConfirming, setRegenConfirming] = useState(false)
  const [pendingPatch, setPendingPatch] = useState<Partial<StudyBrief> | null>(
    null
  )
  const [changedFields, setChangedFields] = useState<string[]>([])
  const [regenMessage, setRegenMessage] = useState("")
  const [resolvedProposals, setResolvedProposals] = useState<
    Record<string, ProposalStatus>
  >({})
  const [collectionChoice, setCollectionChoice] = useState<CollectionMode | null>(
    null
  )
  const [engineChoice, setEngineChoice] = useState<SyntheticMode | null>(null)
  const [selectingCollection, setSelectingCollection] =
    useState<CollectionMode | null>(null)
  const [engineSelecting, setEngineSelecting] = useState<SyntheticMode | null>(
    null
  )
  const [artifactOpen, setArtifactOpen] = useState(false)
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT)
  const autoStartRef = useRef(false)
  const applyingProposalRef = useRef<string | null>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const panelWidthRef = useRef(PANEL_DEFAULT)
  const resizingRef = useRef(false)

  useEffect(() => {
    autoStartRef.current = false
  }, [chatId])

  useEffect(() => {
    setResolvedProposals(readResolvedProposals(chatId))
  }, [chatId])

  const resolveProposal = useCallback(
    (messageId: string, status: ProposalStatus) => {
      setResolvedProposals((prev) => {
        const next = { ...prev, [messageId]: status }
        try {
          window.localStorage.setItem(
            proposalStorageKey(chatId),
            JSON.stringify(next)
          )
        } catch {
          /* storage unavailable — state still updates for this session */
        }
        return next
      })
    },
    [chatId]
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const loadingOlderRef = useRef(false)

  const project = getProject(projectId)
  const chat = getChatsForProject(projectId).find((c) => c.id === chatId)

  const generationEnabled =
    phase === "created" || brief?.status === "created" || !!brief?.study_id

  const {
    run: generationRun,
    steps: generationSteps,
    loaded: generationLoaded,
    starting: generationStarting,
    launching,
    error: generationError,
    isActive: generationActive,
    isReady: generationReady,
    isLaunched: generationLaunched,
    isFailed: generationFailed,
    start: startGeneration,
    retry: retryGeneration,
    launch: launchStudy,
    applyRun,
    toastReadyRef,
  } = useTaskGeneration(chatId, generationEnabled)

  const {
    run: syntheticRun,
    stats: syntheticStats,
    starting: syntheticStarting,
    isActive: syntheticActive,
    isFailed: syntheticFailed,
    start: startSynthetic,
    retry: retrySynthetic,
  } = useSyntheticCollection(chatId, generationLaunched)

  const uploadingCount = uploads.filter((u) => u.status === "uploading").length
  const readyUploads = uploads.filter((u) => u.status === "ready" && u.url)
  const hasUploadErrors = uploads.some((u) => u.status === "error")
  const uploadsBusy = uploadingCount > 0

  const scrollToBottom = useCallback((smooth = true) => {
    stickToBottomRef.current = true
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      })
    })
  }, [])

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`
  }, [])

  const showBriefCard =
    !!brief &&
    ((brief.title.trim().length >= 3 && brief.study_type !== null) ||
      phase === "brief_ready" ||
      phase === "created" ||
      brief.status === "ready" ||
      brief.status === "created")

  useEffect(() => {
    if (showBriefCard) setArtifactOpen(true)
  }, [showBriefCard])

  const openStudyPanel = useCallback(() => setArtifactOpen(true), [])
  const closeStudyPanel = useCallback(() => setArtifactOpen(false), [])
  const requestBriefEdit = useCallback(() => {
    setArtifactOpen(true)
    setEditRequestId((n) => n + 1)
  }, [])

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(PANEL_STORAGE_KEY))
    if (Number.isFinite(stored) && stored >= PANEL_MIN) {
      const next = Math.min(PANEL_MAX, stored)
      panelWidthRef.current = next
      setPanelWidth(next)
    }
  }, [])

  const clampPanelWidth = useCallback((raw: number) => {
    const container = splitRef.current?.getBoundingClientRect().width ?? 1200
    const max = Math.min(PANEL_MAX, Math.floor(container * 0.72))
    const min = Math.min(PANEL_MIN, Math.floor(container * 0.38))
    return Math.max(min, Math.min(max, raw))
  }, [])

  const onResizePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    resizingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  const onResizePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!resizingRef.current || !splitRef.current) return
      const next = clampPanelWidth(
        splitRef.current.getBoundingClientRect().right - event.clientX
      )
      panelWidthRef.current = next
      setPanelWidth(next)
    },
    [clampPanelWidth]
  )

  const onResizePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!resizingRef.current) return
      resizingRef.current = false
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.localStorage.setItem(
        PANEL_STORAGE_KEY,
        String(Math.round(panelWidthRef.current))
      )
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    setReady(false)

    void (async () => {
      try {
        const [messagePage, briefOut] = await Promise.all([
          loadMessages(chatId),
          studyBriefApi.get(chatId),
        ])
        if (cancelled) return
        const msgs = messagePage.messages
        setLocalMessages(msgs)
        setHasMoreMessages(messagePage.hasMore)
        setNextBefore(messagePage.nextBefore)
        prevMessageCountRef.current = msgs.length
        setBrief(briefOut.study_brief)
        setPhase(briefOut.phase)
        try {
          const history = await studyBriefApi.versions(chatId)
          if (!cancelled) {
            setBriefVersions(history.versions)
            setViewingVersion(history.current_version)
          }
        } catch {
          /* versions are optional on first load */
        }
        stickToBottomRef.current = true

        const last = msgs[msgs.length - 1]
        if (last?.role === "user" && briefOut.phase !== "created") {
          setThinkingLive("")
          setThoughtsStreamDone(false)
          setThinking(true)
          const thinkAbort = new AbortController()
          thinkAbortRef.current = thinkAbort
          void studyBriefApi
            .streamThoughts(
              chatId,
              last.content || "",
              [],
              setThinkingLive,
              thinkAbort.signal
            )
            .catch(() => undefined)
            .finally(() => {
              if (!cancelled) setThoughtsStreamDone(true)
            })
          try {
            const cont = await studyBriefApi.aiContinue(chatId)
            if (
              cont &&
              "assistant_message" in cont &&
              cont.assistant_message?.id
            ) {
              const mapped = mapAiTurn(cont)
              setLocalMessages((prev) => [...prev, mapped.assistantMessage])
              setBrief(mapped.studyBrief)
              setPhase(mapped.phase)
              void refreshVersions()
              if (mapped.suggestedChatTitle) {
                void renameChat(chatId, mapped.suggestedChatTitle)
              }
            }
          } catch {
            // Non-fatal
          } finally {
            thinkAbort.abort()
            thinkAbortRef.current = null
            if (!cancelled) {
              setThinking(false)
              setThinkingLive("")
            }
          }
        }

        setReady(true)
        requestAnimationFrame(() => scrollToBottom(false))
      } catch {
        if (!cancelled) {
          toast({
            type: "error",
            title: "Couldn't load chat",
            description: "Please try again.",
          })
          setReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, projectId])

  const loadOlderMessages = useCallback(async () => {
    const container = scrollRef.current
    if (
      !container ||
      !hasMoreMessages ||
      !nextBefore ||
      loadingOlderRef.current
    ) {
      return
    }

    loadingOlderRef.current = true
    setLoadingOlder(true)
    const previousHeight = container.scrollHeight
    const previousTop = container.scrollTop

    try {
      const page = await loadMessages(chatId, nextBefore)
      setLocalMessages((current) => {
        const known = new Set(current.map((message) => message.id))
        const older = page.messages.filter((message) => !known.has(message.id))
        return [...older, ...current]
      })
      setHasMoreMessages(page.hasMore)
      setNextBefore(page.nextBefore)

      requestAnimationFrame(() => {
        const nextContainer = scrollRef.current
        if (!nextContainer) return
        nextContainer.scrollTop =
          previousTop + (nextContainer.scrollHeight - previousHeight)
      })
    } catch {
      toast({
        type: "error",
        title: "Couldn't load older messages",
        description: "Scroll up to try again.",
      })
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [chatId, hasMoreMessages, loadMessages, nextBefore, toast])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = distanceFromBottom < 80
      if (el.scrollTop < 120) void loadOlderMessages()
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [chatId, loadOlderMessages])

  useEffect(() => {
    const count = localMessages.length
    const grew = count > prevMessageCountRef.current
    prevMessageCountRef.current = count
    if (!grew) return
    const lastIsUser = localMessages[localMessages.length - 1]?.role === "user"
    if (stickToBottomRef.current || lastIsUser || thinking) scrollToBottom()
  }, [localMessages, scrollToBottom, thinking])

  useEffect(() => {
    if (projectsLoading || chatsLoading) return
    if (project && chat) return
    const t = window.setTimeout(() => {
      void (async () => {
        await Promise.all([refreshProjects(), refreshChats()])
        const p = getProject(projectId)
        if (!p) {
          router.replace("/welcome")
          return
        }
        const c = getChatsForProject(projectId).find((x) => x.id === chatId)
        if (!c) router.replace(`/project/${projectId}`)
      })()
    }, 400)
    return () => window.clearTimeout(t)
  }, [
    projectsLoading,
    chatsLoading,
    project,
    chat,
    projectId,
    chatId,
    refreshProjects,
    refreshChats,
    getProject,
    getChatsForProject,
    router,
  ])

  useEffect(() => {
    return () => {
      for (const f of uploads) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [draft, resizeTextarea])

  useEffect(() => {
    const folderInput = folderInputRef.current
    if (!folderInput) return
    folderInput.setAttribute("webkitdirectory", "")
    folderInput.setAttribute("directory", "")
  }, [ready])

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      try {
        if (item.file.size > 25 * 1024 * 1024) {
          throw new Error("File exceeds 25 MB")
        }
        const uploaded = await studyBriefApi.upload(chatId, item.file, {
          category: item.category,
          relativePath: item.relativePath,
        })
        const extracted = uploaded.extracted_text ?? null
        const looksLikeDocument =
          /\.(pdf|docx|doc|txt|csv|md)$/i.test(item.file.name) ||
          (uploaded.content_type || "").includes("pdf") ||
          (uploaded.content_type || "").includes("word")
        if (looksLikeDocument && !(extracted && extracted.trim())) {
          toast({
            type: "warning",
            title: "Couldn't read document text",
            description:
              item.file.name.toLowerCase().endsWith(".doc") &&
              !item.file.name.toLowerCase().endsWith(".docx")
                ? "Legacy .doc files aren't supported. Please upload a .docx or PDF."
                : `We uploaded ${item.file.name}, but couldn't extract its text. Try a .docx or text-based PDF.`,
          })
        }
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? {
                  ...u,
                  status: "ready",
                  url: uploaded.url,
                  contentType: uploaded.content_type,
                  category: uploaded.category ?? item.category,
                  extractedText: extracted,
                  error: undefined,
                }
              : u
          )
        )
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? {
                  ...u,
                  status: "error",
                  error:
                    err instanceof ApiError
                      ? err.message
                      : err instanceof Error
                        ? err.message
                        : "Upload failed",
                }
              : u
          )
        )
      }
    },
    [chatId, toast]
  )

  const startUploads = useCallback(
    async (incoming: UploadItem[]) => {
      if (!incoming.length) return
      setUploads((prev) => [...prev, ...incoming].slice(0, MAX_ATTACHMENTS))
      await mapPool(incoming, UPLOAD_CONCURRENCY, (item) => uploadOne(item))
    },
    [uploadOne]
  )

  const retryFailedUploads = useCallback(async () => {
    const failed = uploads.filter((u) => u.status === "error")
    if (!failed.length) return
    setUploads((prev) =>
      prev.map((u) =>
        u.status === "error"
          ? { ...u, status: "uploading", error: undefined }
          : u
      )
    )
    await mapPool(failed, UPLOAD_CONCURRENCY, (item) =>
      uploadOne({ ...item, status: "uploading" })
    )
  }, [uploads, uploadOne])

  const handlePickFiles = (files: FileList | null) => {
    if (!files?.length) return
    setAttachMenuOpen(false)
    const parsed = parseUploadSelection(files)

    if (parsed.emptyCategories.length) {
      toast({
        type: "warning",
        title: "No images in some folders",
        description: parsed.emptyCategories.join(", "),
      })
    }
    if (!parsed.items.length) {
      toast({
        type: "error",
        title: "No supported files found",
        description:
          parsed.skippedUnsupported > 0
            ? "Use images, a PDF, or a Word (.docx) file."
            : "Choose image files, a folder of images, or a PDF / Word file.",
      })
      return
    }
    if (parsed.skippedUnsupported > 0) {
      toast({
        type: "info",
        title: "Some files skipped",
        description: `${parsed.skippedUnsupported} unsupported file(s) were ignored.`,
      })
    }

    const room = Math.max(0, MAX_ATTACHMENTS - uploads.length)
    const next: UploadItem[] = parsed.items.slice(0, room).map((item) => ({
      ...item,
      status: "uploading" as const,
    }))
    if (parsed.items.length > room) {
      toast({
        type: "warning",
        title: "Attachment limit",
        description: `Only the first ${MAX_ATTACHMENTS} files were kept.`,
      })
    }
    void startUploads(next)
  }

  const removeUpload = (id: string) => {
    setUploads((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const refreshVersions = useCallback(async () => {
    try {
      const history = await studyBriefApi.versions(chatId)
      setBriefVersions(history.versions)
      setViewingVersion(history.current_version)
    } catch {
      /* keep the last known history */
    }
  }, [chatId])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const content = draft.trim()
    if (
      (!content && readyUploads.length === 0) ||
      sending ||
      thinking ||
      chatLocked ||
      uploadsBusy ||
      hasUploadErrors
    ) {
      return
    }

    const attachments: AttachmentBrief[] = readyUploads.map((u) => ({
      url: u.url!,
      filename: u.file.name,
      content_type: u.contentType || u.file.type || "application/octet-stream",
      category: u.category ?? null,
      relative_path: u.relativePath ?? null,
      extracted_text: u.extractedText ?? null,
    }))

    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId,
      chatId,
      role: "user",
      content:
        content ||
        (attachments.length
          ? `Uploaded ${attachments.length} file(s)`
          : ""),
      createdAt: new Date(),
      metadata: attachments.length
        ? { kind: "attachments", attachments }
        : undefined,
    }

    setLocalMessages((prev) => [...prev, optimistic])
    speech.stop()
    setDraft("")
    setThinkingLive("")
    setThoughtsStreamDone(false)
    setSending(true)
    setThinking(true)
    const thinkAbort = new AbortController()
    thinkAbortRef.current = thinkAbort
    void studyBriefApi
      .streamThoughts(
        chatId,
        content,
        attachments,
        setThinkingLive,
        thinkAbort.signal
      )
      .catch(() => undefined)
      .finally(() => setThoughtsStreamDone(true))
    scrollToBottom()
    requestAnimationFrame(resizeTextarea)

    const snapshotUploads = uploads
    setUploads([])
    for (const u of snapshotUploads) {
      if (u.previewUrl) URL.revokeObjectURL(u.previewUrl)
    }

    const isFirstMessage = localMessages.length === 0

    try {
      const dto = await studyBriefApi.aiTurn(chatId, content, attachments)
      const mapped = mapAiTurn(dto)
      setLocalMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId)
        return [
          ...withoutTemp,
          ...(mapped.userMessage ? [mapped.userMessage] : []),
          mapped.assistantMessage,
        ]
      })
      setBrief(mapped.studyBrief)
      setPhase(mapped.phase)
      void refreshVersions()

      if (
        mapped.suggestedChatTitle &&
        (isFirstMessage || chat?.title === "New Chat")
      ) {
        void renameChat(chatId, mapped.suggestedChatTitle)
      }
    } catch (err) {
      setLocalMessages((prev) => prev.filter((m) => m.id !== tempId))
      setDraft(content)
      toast({
        type: "error",
        title: "Couldn't send message",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      thinkAbort.abort()
      thinkAbortRef.current = null
      setSending(false)
      setThinking(false)
      setThinkingLive("")
    }
  }

  const handleRestoreVersion = async () => {
    if (!viewingVersion || viewingVersion === briefVersions.at(-1)?.version) {
      return
    }
    setRestoringVersion(true)
    try {
      const out = await studyBriefApi.restoreVersion(chatId, viewingVersion)
      setBrief(out.study_brief)
      setPhase(out.phase)
      await refreshVersions()
      toast({
        type: "success",
        title: `Restored version ${viewingVersion}`,
        description: "A new draft version was created from that snapshot.",
      })
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't restore that version",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setRestoringVersion(false)
    }
  }

  const handleSaveBrief = async (patch: Partial<StudyBrief>) => {
    // After tasks exist (or generation ran), check whether regeneration is needed.
    const shouldCheckRegen =
      !!generationRun &&
      !generationLaunched &&
      generationRun.status !== "queued" &&
      !generationActive

    if (shouldCheckRegen) {
      try {
        const preview = await taskGenerationApi.previewChanges(chatId, patch)
        if (preview.requires_regeneration) {
          setPendingPatch(patch)
          setChangedFields(preview.changed_fields)
          setRegenMessage(preview.message)
          setRegenOpen(true)
          return
        }
      } catch (err) {
        toast({
          type: "error",
          title: "Couldn't check changes",
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
        throw err
      }
    }

    try {
      const out = await studyBriefApi.update(chatId, patch)
      setBrief(out.study_brief)
      setPhase(out.phase)
      void refreshVersions()
      try {
        const messagePage = await loadMessages(chatId)
        setLocalMessages(messagePage.messages)
        setHasMoreMessages(messagePage.hasMore)
        setNextBefore(messagePage.nextBefore)
      } catch {
        /* chat note is optional */
      }
      toast({ type: "success", title: "Brief updated" })
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't save changes",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      throw err
    }
  }

  const confirmRegenerate = async () => {
    if (!pendingPatch) return
    setRegenConfirming(true)
    try {
      const res = await taskGenerationApi.regenerate(chatId, {
        ...pendingPatch,
        confirm_regeneration: true,
      })
      applyRun(res.run)
      const out = await studyBriefApi.get(chatId)
      setBrief(out.study_brief)
      setPhase(out.phase)
      setRegenOpen(false)
      setPendingPatch(null)
      void refreshVersions()
      if (applyingProposalRef.current) {
        resolveProposal(applyingProposalRef.current, "applied")
        applyingProposalRef.current = null
      }
      toast({
        type: "info",
        title: "Regenerating tasks",
        description: "We’re rebuilding your study tasks from the updated brief.",
      })
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't regenerate",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setRegenConfirming(false)
    }
  }

  const handleContinue = async () => {
    setConfirming(true)
    autoStartRef.current = true
    try {
      const out = await studyBriefApi.confirm(chatId)
      setBrief(out.study_brief)
      setPhase(out.phase)
      void refreshVersions()
      const messagePage = await loadMessages(chatId)
      setLocalMessages(messagePage.messages)
      setHasMoreMessages(messagePage.hasMore)
      setNextBefore(messagePage.nextBefore)
      toast({
        type: "success",
        title: "Study draft created",
        description: "Task generation is starting in the background.",
      })
      setConfirming(false)
      void startGeneration()
        .then((gen) => applyRun(gen.run))
        .catch((err) => {
          toast({
            type: "error",
            title: "Couldn't start task generation",
            description:
              err instanceof ApiError
                ? err.message
                : "Your draft is safe — use Retry when you’re ready.",
          })
        })
      if (stickToBottomRef.current) scrollToBottom()
    } catch (err) {
      autoStartRef.current = false
      toast({
        type: "error",
        title: "Couldn't create study",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setConfirming(false)
    }
  }

  // Restore collection choice after launch (refresh / return to chat).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`mindsurve_collection_${chatId}`)
      setCollectionChoice(raw === "ai" || raw === "cint" ? raw : null)
      const engine = window.localStorage.getItem(
        `mindsurve_collection_engine_${chatId}`
      )
      setEngineChoice(engine === "ai" || engine === "randomize" ? engine : null)
    } catch {
      setCollectionChoice(null)
      setEngineChoice(null)
    }
  }, [chatId])

  // If a synthetic run already exists, treat collection as AI + engine selected.
  useEffect(() => {
    if (!syntheticRun) return
    setCollectionChoice("ai")
    setEngineChoice(syntheticRun.mode)
    try {
      window.localStorage.setItem(`mindsurve_collection_${chatId}`, "ai")
      window.localStorage.setItem(
        `mindsurve_collection_engine_${chatId}`,
        syntheticRun.mode
      )
    } catch {
      /* ignore */
    }
  }, [chatId, syntheticRun])

  // Auto-start generation only for a created draft that has no run yet.
  useEffect(() => {
    if (!generationEnabled || !generationLoaded) return
    if (generationRun || generationStarting) return
    if (autoStartRef.current) return
    autoStartRef.current = true
    void (async () => {
      try {
        await startGeneration()
      } catch {
        /* draft remains; user can retry from the card */
      }
    })()
  }, [
    generationEnabled,
    generationLoaded,
    generationRun,
    generationStarting,
    startGeneration,
  ])

  // Toast once when tasks become ready.
  useEffect(() => {
    if (!generationRun || generationRun.status !== "ready") return
    if (toastReadyRef.current === generationRun.id) return
    toastReadyRef.current = generationRun.id
    toast({
      type: "success",
      title: "Tasks ready",
      description: "Preview your study, then launch when you’re happy.",
    })
  }, [generationRun, toast, toastReadyRef])

  // Creating the draft is atomic; task generation runs independently in the background.
  const chatLocked = confirming

  useEffect(() => {
    if (chatLocked || sending || thinking) speech.stop()
  }, [chatLocked, sending, thinking, speech.stop])

  const allowBriefEdit =
    !!generationRun &&
    !generationLaunched &&
    !generationActive &&
    (generationReady || generationFailed)

  const editLockedMessage = generationLaunched
    ? "This study is live. Task-affecting edits are locked, but you can still chat."
    : generationActive
      ? "Task generation is running. Wait for it to finish before editing."
      : null

  const composerHint = generationLaunched
    ? "Study is collecting responses. You can keep chatting — study edits stay locked."
    : generationActive || generationStarting
      ? null
      : generationReady
        ? "Tasks are ready. You can still message us, or preview / launch above."
        : generationFailed
          ? "Task generation needs a retry. Your draft study is safe."
          : confirming
            ? "Creating your study draft…"
            : null

  const composerPlaceholder = speech.listening
    ? "Listening…"
    : generationLaunched || generationActive || generationStarting
      ? "Message MindSurve…"
      : uploadsBusy
          ? "Uploading files… send unlocks when ready"
          : "Message MindSurve…"

  const handleCollectionChoice = (mode: CollectionMode) => {
    setSelectingCollection(mode)
    try {
      window.localStorage.setItem(`mindsurve_collection_${chatId}`, mode)
    } catch {
      /* ignore */
    }
    setCollectionChoice(mode)
    setSelectingCollection(null)
    if (mode === "cint") {
      setEngineChoice(null)
      toast({
        type: "success",
        title: "Cint request sent",
        description:
          "Our team will run Cint and let you know when it’s completed.",
      })
      return
    }
    toast({
      type: "info",
      title: "Choose rating mode",
      description: "Pick AI ratings or randomized ratings to start collection.",
    })
  }

  const handleEngineChoice = (mode: SyntheticMode) => {
    setEngineSelecting(mode)
    void (async () => {
      try {
        window.localStorage.setItem(
          `mindsurve_collection_engine_${chatId}`,
          mode
        )
      } catch {
        /* ignore */
      }
      setEngineChoice(mode)
      try {
        await startSynthetic(mode)
        toast({
          type: "success",
          title:
            mode === "randomize"
              ? "Randomized collection started"
              : "AI collection started",
          description: "Watch response statistics update as respondents finish.",
        })
      } catch (err) {
        toast({
          type: "error",
          title: "Couldn't start collection",
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
      } finally {
        setEngineSelecting(null)
      }
    })()
  }

  if (projectsLoading || chatsLoading || !ready || !project || !chat) {
    return (
      <AppShell selectedProjectId={projectId} selectedChatId={chatId}>
        <main className="flex flex-1 items-center justify-center px-4">
          <Skeleton className="h-40 w-full max-w-xl rounded-xl" />
        </main>
      </AppShell>
    )
  }

  const canSend =
    (draft.trim().length > 0 || readyUploads.length > 0) &&
    !sending &&
    !thinking &&
    !chatLocked &&
    !uploadsBusy &&
    !hasUploadErrors

  // A chat edit that would rebuild the task matrix is held until the user confirms.
  const pendingProposal = (() => {
    const lastAssistant = [...localMessages]
      .reverse()
      .find((m) => m.role === "assistant")
    if (!lastAssistant || resolvedProposals[lastAssistant.id] === "discarded") {
      return null
    }
    const meta = lastAssistant.metadata as
      | {
          kind?: string
          pending_patch?: Partial<StudyBrief>
          changed_fields?: string[]
          pending_preview?: PendingPreview
        }
      | undefined
    if (meta?.kind !== "regeneration_request" || !meta.pending_patch) return null
    return {
      id: lastAssistant.id,
      patch: meta.pending_patch,
      changedFields: meta.changed_fields ?? [],
      preview: meta.pending_preview,
      applied: resolvedProposals[lastAssistant.id] === "applied",
    }
  })()

  const latestVersion = briefVersions.at(-1)?.version ?? 0
  const viewedSnapshot =
    briefVersions.find((item) => item.version === viewingVersion)?.study_brief
  const displayBrief =
    viewingVersion && viewingVersion !== latestVersion && viewedSnapshot
      ? viewedSnapshot
      : brief

  const briefCardProps = brief
    ? {
        brief,
        displayBrief,
        phase,
        confirming,
        allowEdit: allowBriefEdit,
        editLockedMessage,
        onContinue: () => void handleContinue(),
        onSaveEdit: handleSaveBrief,
        onOpenPanel: openStudyPanel,
        onClosePanel: closeStudyPanel,
        onRequestEdit: requestBriefEdit,
        panelOpen: artifactOpen,
        versionCurrent: latestVersion,
        versionTotal: briefVersions.length,
        viewingVersion: viewingVersion || latestVersion,
        versionSummary: briefVersions.at(-1)?.summary,
        versions: briefVersions,
        onViewVersion: setViewingVersion,
        onRestoreVersion: () => void handleRestoreVersion(),
        restoringVersion,
      }
    : null

  return (
    <AppShell
      selectedProjectId={projectId}
      selectedChatId={chatId}
      projectTitle={`${project.title} / ${chat.title}`}
    >
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-200/50 bg-white/50 px-3 py-2 backdrop-blur-sm sm:px-4">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{project.title}</span>
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="min-w-0 truncate text-sm font-medium text-gray-900">
            {chat.title}
          </h1>
          {showBriefCard && !artifactOpen && (
            <button
              type="button"
              onClick={openStudyPanel}
              className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              <PanelRightOpen className="size-3.5" />
              Open study
            </button>
          )}
        </div>

        <div ref={splitRef} className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-4"
        >
          <div className="mx-auto max-w-3xl py-6">
            {localMessages.length === 0 && !thinking ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-sm">
                  <Sparkles className="size-5" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 sm:text-2xl">
                  What study should we create?
                </h2>
                <p className="mt-2 max-w-md text-sm text-gray-500">
                  Describe your idea. Upload images for a visual (grid) study, or
                  a PDF / Word file — if you don’t have images, we’ll build a
                  text study with statements to rate.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(loadingOlder || hasMoreMessages) && (
                  <div className="flex h-8 items-center justify-center text-xs text-gray-400">
                    {loadingOlder ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" />
                        Loading older messages…
                      </span>
                    ) : (
                      <span>Scroll up for older messages</span>
                    )}
                  </div>
                )}
                {localMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}

                {(thinking || confirming) && (
                  <ThinkingStatus
                    liveText={thinkingLive}
                    streamDone={thoughtsStreamDone}
                  />
                )}

                {pendingProposal && !thinking && (
                  <AssistantBlock>
                    <PendingRegenerationCard
                      changedFields={pendingProposal.changedFields}
                      preview={pendingProposal.preview}
                      applied={pendingProposal.applied}
                      disabled={regenConfirming}
                      onApply={() => {
                        applyingProposalRef.current = pendingProposal.id
                        setPendingPatch(pendingProposal.patch)
                        setChangedFields(pendingProposal.changedFields)
                        setRegenMessage(
                          "Applying this edit replaces the tasks generated from the current version."
                        )
                        setRegenOpen(true)
                      }}
                      onDismiss={() =>
                        resolveProposal(pendingProposal.id, "discarded")
                      }
                    />
                  </AssistantBlock>
                )}

                {showBriefCard && briefCardProps && !thinking && (
                  <AssistantBlock>
                    <StudyBriefCard {...briefCardProps} layout="compact" />
                  </AssistantBlock>
                )}

                {generationEnabled &&
                  generationLoaded &&
                  !generationRun &&
                  generationError &&
                  !generationStarting && (
                    <AssistantBlock>
                      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                        <p className="text-sm font-medium text-amber-950">
                          Couldn’t start task generation
                        </p>
                        <p className="mt-1 text-xs text-amber-900">
                          {generationError}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            void startGeneration().catch((err) => {
                              toast({
                                type: "error",
                                title: "Retry failed",
                                description:
                                  err instanceof ApiError
                                    ? err.message
                                    : "Please try again.",
                              })
                            })
                          }}
                          className="mt-2 inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Retry generation
                        </button>
                      </div>
                    </AssistantBlock>
                  )}

                {generationRun &&
                  (generationReady || generationLaunched) &&
                  !generationActive && (
                    <AssistantBlock>
                      <StudyReadyCard
                        run={generationRun}
                        studyTitle={brief?.title}
                        launching={launching}
                        editDisabled={!allowBriefEdit}
                        onPreview={() => {
                          const url = generationRun.preview_url
                          if (url) {
                            window.open(url, "_blank", "noopener,noreferrer")
                          } else {
                            toast({
                              type: "warning",
                              title: "Preview unavailable",
                              description: "Preview URL isn’t ready yet.",
                            })
                          }
                        }}
                        onEdit={allowBriefEdit ? requestBriefEdit : undefined}
                        onLaunch={async () => {
                          try {
                            const res = await launchStudy()
                            toast({
                              type: "success",
                              title: "Study launched",
                              description:
                                res.message ||
                                "Share the participant link to collect responses.",
                            })
                          } catch (err) {
                            toast({
                              type: "error",
                              title: "Couldn't launch study",
                              description:
                                err instanceof ApiError
                                  ? err.message
                                  : "Please try again.",
                            })
                          }
                        }}
                      />
                    </AssistantBlock>
                  )}

                {generationLaunched && (
                  <AssistantBlock>
                    <CollectionChoiceCard
                      studyTitle={brief?.title}
                      choice={collectionChoice}
                      engineChoice={engineChoice}
                      selecting={selectingCollection}
                      engineSelecting={engineSelecting}
                      onChoose={handleCollectionChoice}
                      onChooseEngine={handleEngineChoice}
                      stats={
                        engineChoice
                          ? syntheticStats
                          : null
                      }
                      progress={syntheticRun?.progress ?? null}
                      statusMessage={syntheticRun?.message ?? null}
                      collecting={syntheticActive || syntheticStarting}
                      collectionFailed={syntheticFailed}
                      retrying={syntheticStarting}
                      onRetryCollection={() => {
                        void retrySynthetic().catch((err) => {
                          toast({
                            type: "error",
                            title: "Retry failed",
                            description:
                              err instanceof ApiError
                                ? err.message
                                : "Please try again.",
                          })
                        })
                      }}
                    />
                  </AssistantBlock>
                )}

                <RegenerateWarningDialog
                  open={regenOpen}
                  changedFields={changedFields}
                  message={regenMessage}
                  confirming={regenConfirming}
                  onCancel={() => {
                    setRegenOpen(false)
                    setPendingPatch(null)
                    applyingProposalRef.current = null
                  }}
                  onConfirm={() => void confirmRegenerate()}
                />

                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 bg-gradient-to-t from-blue-500/10 via-white/85 to-transparent px-3 pb-4 pt-2 sm:px-4">
          {generationRun &&
            (generationActive || generationStarting || generationFailed) && (
              <div className="mx-auto mb-2 max-w-3xl">
                <StudyGenerationCard
                  run={generationRun}
                  steps={generationSteps}
                  retrying={generationStarting}
                  onRetry={() => {
                    void retryGeneration().catch((err) => {
                      toast({
                        type: "error",
                        title: "Retry failed",
                        description:
                          err instanceof ApiError
                            ? err.message
                            : "Please try again.",
                      })
                    })
                  }}
                />
              </div>
            )}

          {generationStarting && !generationRun && (
            <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-2 shadow-sm">
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-blue-500" />
              <Loader2 className="size-3.5 shrink-0 animate-spin text-blue-500" />
              <span className="text-[13px] font-medium text-gray-900">
                Generating study tasks
              </span>
              <span className="truncate text-xs text-gray-400">· Starting…</span>
            </div>
          )}

          {composerHint && (
            <p className="mx-auto mb-2 max-w-3xl text-center text-xs text-gray-500">
              {composerHint}
            </p>
          )}

          <form
            onSubmit={(e) => void handleSend(e)}
            className="mx-auto max-w-3xl"
          >
            <div
              className={`rounded-[28px] border bg-white/95 shadow-sm backdrop-blur-md ${
                speech.listening
                  ? "border-red-200 ring-2 ring-red-100"
                  : "border-blue-100/90"
              } ${chatLocked ? "opacity-60" : ""}`}
            >
              {uploads.length > 0 && (
                <div className="border-b border-gray-100 px-2.5 pt-2.5 sm:px-3 sm:pt-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-gray-500">
                      {readyUploads.length}/{uploads.length} ready
                      {hasUploadErrors ? " · some failed" : ""}
                    </span>
                    <div className="flex items-center gap-1">
                      {hasUploadErrors && (
                        <button
                          type="button"
                          onClick={() => void retryFailedUploads()}
                          disabled={sending || thinking || uploadsBusy}
                          className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Retry failed
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          for (const u of uploads) removeUpload(u.id)
                        }}
                        disabled={sending || thinking}
                        className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pb-2 sm:max-h-40 sm:gap-2">
                    {uploads.map((f) => (
                      <div
                        key={f.id}
                        className="relative flex min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-blue-50 bg-blue-50/40 px-1.5 py-1 text-xs text-gray-600 sm:gap-2 sm:px-2 sm:py-1.5"
                      >
                        {f.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={f.previewUrl}
                            alt=""
                            className="size-8 shrink-0 rounded-md object-cover sm:size-9"
                          />
                        ) : (
                          <Paperclip className="size-3.5 shrink-0 text-blue-500" />
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[96px] truncate font-medium text-gray-700 sm:max-w-[140px]">
                            {displayNameForUpload(f)}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {f.status === "uploading" && "Uploading…"}
                            {f.status === "ready" && "Ready"}
                            {f.status === "error" && (f.error || "Failed")}
                          </p>
                        </div>
                        {f.status === "uploading" && (
                          <Loader2 className="size-3.5 shrink-0 animate-spin text-blue-500" />
                        )}
                        {f.status === "ready" && (
                          <Check className="size-3.5 shrink-0 text-emerald-600" />
                        )}
                        {f.status === "error" && (
                          <AlertCircle className="size-3.5 shrink-0 text-red-500" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeUpload(f.id)}
                          disabled={sending || thinking}
                          className="shrink-0 cursor-pointer rounded p-0.5 text-gray-400 hover:bg-white hover:text-gray-700 disabled:cursor-not-allowed"
                          aria-label="Remove file"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  if (speech.listening) speech.stop()
                  setDraft(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder={composerPlaceholder}
                rows={1}
                disabled={sending || thinking || chatLocked}
                className="max-h-48 min-h-[56px] w-full resize-none overflow-y-auto border-0 bg-transparent px-4 pt-3.5 text-[15px] leading-6 text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
              />

              <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      handlePickFiles(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  <input
                    ref={docInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.docx,.txt,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(e) => {
                      handlePickFiles(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      handlePickFiles(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  <button
                    type="button"
                    disabled={chatLocked || sending || thinking}
                    onClick={() => setAttachMenuOpen((v) => !v)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
                    aria-label="Add attachment"
                  >
                    <Plus className="size-5" />
                  </button>
                  {attachMenuOpen && (
                    <div className="absolute bottom-11 left-0 z-20 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="size-4 text-blue-500" />
                        Upload images
                      </button>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => docInputRef.current?.click()}
                      >
                        <FileText className="size-4 text-blue-500" />
                        Upload PDF or Word
                      </button>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => folderInputRef.current?.click()}
                      >
                        <FolderOpen className="size-4 text-blue-500" />
                        Upload folder
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {uploadsBusy && (
                    <span className="hidden text-[11px] text-gray-500 sm:inline">
                      Uploading {uploadingCount}…
                    </span>
                  )}
                  {speech.listening && (
                    <span className="hidden text-[11px] font-medium text-red-500 sm:inline">
                      Listening…
                    </span>
                  )}
                  <SpeechToTextButton
                    listening={speech.listening}
                    supported={speech.supported}
                    disabled={chatLocked || sending || thinking}
                    onToggle={() => speech.toggle(draft)}
                  />
                  <Button
                    type="submit"
                    disabled={!canSend}
                    className="h-10 w-10 shrink-0 cursor-pointer rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    {sending || thinking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-gray-400">
              Enter to send · Shift+Enter for a new line · Mic to dictate ·
              Folder upload uses subfolders as categories
            </p>
          </form>
        </div>
        </div>

        {showBriefCard && briefCardProps && artifactOpen && (
          <>
            <button
              type="button"
              aria-label="Resize study panel"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
              onPointerCancel={onResizePointerUp}
              className="relative hidden w-1.5 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400 lg:block"
            >
              <span className="absolute inset-y-0 -left-1 -right-1" />
            </button>
            <aside
              style={{ width: panelWidth }}
              className="hidden min-h-0 shrink-0 bg-white lg:flex lg:flex-col"
            >
              <StudyBriefCard
                {...briefCardProps}
                layout="panel"
                editRequestId={editRequestId}
              />
            </aside>
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 cursor-pointer bg-black/30"
                aria-label="Close study panel"
                onClick={closeStudyPanel}
              />
              <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl">
                <StudyBriefCard
                  {...briefCardProps}
                  layout="panel"
                  editRequestId={editRequestId}
                />
              </aside>
            </div>
          </>
        )}
        </div>
      </main>
    </AppShell>
  )
}

const CHANGE_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  background: "Background",
  main_question: "Main question",
  orientation_text: "Orientation",
  rating_scale: "Rating scale",
  categories: "Categories & statements",
  classification_questions: "Screening questions",
  audience: "Audience",
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  const attachments = Array.isArray(message.metadata?.attachments)
    ? (message.metadata?.attachments as {
        url?: string
        filename?: string
        category?: string
      }[])
    : []
  const changedFields = Array.isArray(message.metadata?.changed_fields)
    ? (message.metadata?.changed_fields as string[]).filter(Boolean)
    : []

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500">
          <Bot className="size-4 text-white" />
        </div>
      )}
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-2.5 sm:max-w-[78%] ${
          isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-6">
            {message.content}
          </p>
        ) : (
          <>
            {changedFields.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {changedFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-blue-700"
                  >
                    {CHANGE_FIELD_LABELS[field] || field}
                  </span>
                ))}
              </div>
            )}
            <AssistantMarkdown content={message.content} />
          </>
        )}
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <a
                key={a.url || a.filename}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
                  isUser
                    ? "bg-white/15 text-white hover:bg-white/25"
                    : "bg-white text-blue-600 hover:bg-blue-50"
                }`}
              >
                {a.url && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(a.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt=""
                    className="size-5 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="size-3" />
                )}
                <span className="max-w-[140px] truncate">
                  {a.category
                    ? `${a.category}/${a.filename || "image"}`
                    : a.filename || "Attachment"}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-500">
          <User className="size-4 text-white" />
        </div>
      )}
    </div>
  )
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="my-2 first:mt-0 last:mb-0 text-sm leading-6 text-gray-800">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-950">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-700">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="my-2.5 list-disc space-y-1.5 pl-5 text-sm leading-6 marker:text-blue-500">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2.5 list-decimal space-y-1.5 pl-5 text-sm leading-6 marker:font-medium marker:text-blue-600">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-1 text-gray-800">{children}</li>,
        h1: ({ children }) => (
          <h1 className="mb-2 mt-3 text-base font-semibold text-gray-950 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1.5 mt-3 text-sm font-semibold text-gray-950 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2.5 text-sm font-semibold text-gray-900 first:mt-0">
            {children}
          </h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-blue-300 pl-3 text-gray-600">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-gray-200/80 px-1 py-0.5 font-mono text-[0.82em] text-gray-800">
            {children}
          </code>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-gray-200" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function AssistantBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
