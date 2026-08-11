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
  Paperclip,
  Loader2,
  X,
  FolderOpen,
  ImagePlus,
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
import { StudyBriefCard } from "@/components/studies/StudyBriefCard"
import { useProjects } from "@/context/ProjectsContext"
import { useChats } from "@/context/ChatsContext"
import { useToast } from "@/components/feedback/Toaster"
import { ApiError } from "@/lib/api/types"
import { mapAiTurn, studyBriefApi } from "@/lib/api/studyBrief"
import {
  displayNameForUpload,
  mapPool,
  parseUploadSelection,
  type UploadItem,
} from "@/lib/chat-uploads"
import type { ChatMessage } from "@/types"
import type { AttachmentBrief, BriefPhase, StudyBrief } from "@/types/study-brief"

const MAX_ATTACHMENTS = 40
const UPLOAD_CONCURRENCY = 4

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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const loadingOlderRef = useRef(false)

  const project = getProject(projectId)
  const chat = getChatsForProject(projectId).find((c) => c.id === chatId)

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
    (phase === "brief_ready" ||
      phase === "created" ||
      brief.status === "ready" ||
      brief.status === "created")

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
        stickToBottomRef.current = true

        const last = msgs[msgs.length - 1]
        if (last?.role === "user" && briefOut.phase !== "created") {
          setThinking(true)
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
              if (mapped.suggestedChatTitle) {
                void renameChat(chatId, mapped.suggestedChatTitle)
              }
            }
          } catch {
            // Non-fatal
          } finally {
            if (!cancelled) setThinking(false)
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

  const chatLocked = phase === "created" || confirming

  const startUploads = useCallback(
    async (incoming: UploadItem[]) => {
      if (!incoming.length) return
      setUploads((prev) => [...prev, ...incoming].slice(0, MAX_ATTACHMENTS))

      await mapPool(incoming, UPLOAD_CONCURRENCY, async (item) => {
        try {
          if (item.file.size > 25 * 1024 * 1024) {
            throw new Error("File exceeds 25 MB")
          }
          const uploaded = await studyBriefApi.upload(chatId, item.file, {
            category: item.category,
            relativePath: item.relativePath,
          })
          setUploads((prev) =>
            prev.map((u) =>
              u.id === item.id
                ? {
                    ...u,
                    status: "ready",
                    url: uploaded.url,
                    contentType: uploaded.content_type,
                    category: uploaded.category ?? item.category,
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
      })
    },
    [chatId]
  )

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
        title: "No images found",
        description:
          parsed.skippedNonImages > 0
            ? "The selection didn’t include any image files."
            : "Choose image files or a folder that contains images.",
      })
      return
    }
    if (parsed.skippedNonImages > 0) {
      toast({
        type: "info",
        title: "Skipped non-images",
        description: `${parsed.skippedNonImages} non-image file(s) were ignored.`,
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
      content_type: u.contentType || u.file.type || "image/png",
      category: u.category ?? null,
      relative_path: u.relativePath ?? null,
    }))

    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId,
      chatId,
      role: "user",
      content:
        content ||
        (attachments.length
          ? `Uploaded ${attachments.length} image(s)`
          : ""),
      createdAt: new Date(),
      metadata: attachments.length
        ? { kind: "attachments", attachments }
        : undefined,
    }

    setLocalMessages((prev) => [...prev, optimistic])
    setDraft("")
    setSending(true)
    setThinking(true)
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
      setSending(false)
      setThinking(false)
    }
  }

  const handleSaveBrief = async (patch: Partial<StudyBrief>) => {
    try {
      const out = await studyBriefApi.update(chatId, patch)
      setBrief(out.study_brief)
      setPhase(out.phase)
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

  const handleContinue = async () => {
    setConfirming(true)
    try {
      const out = await studyBriefApi.confirm(chatId)
      setBrief(out.study_brief)
      setPhase(out.phase)
      const messagePage = await loadMessages(chatId)
      setLocalMessages(messagePage.messages)
      setHasMoreMessages(messagePage.hasMore)
      setNextBefore(messagePage.nextBefore)
      toast({
        type: "success",
        title: "Study draft created",
        description: "Task generation will be available next.",
      })
      scrollToBottom()
    } catch (err) {
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
          <h1 className="truncate text-sm font-medium text-gray-900">
            {chat.title}
          </h1>
        </div>

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
                  Describe your idea, or upload a folder of categories with
                  images — we’ll build the brief with you.
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

                {thinking && (
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500">
                      <Bot className="size-4 text-white" />
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      MindSurve is thinking…
                    </span>
                  </div>
                )}

                {showBriefCard && brief && !thinking && (
                  <AssistantBlock>
                    <StudyBriefCard
                      brief={brief}
                      phase={phase}
                      confirming={confirming}
                      onContinue={() => void handleContinue()}
                      onSaveEdit={handleSaveBrief}
                    />
                  </AssistantBlock>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 bg-gradient-to-t from-blue-500/10 via-white/85 to-transparent px-3 pb-4 pt-2 sm:px-4">
          {chatLocked && (
            <p className="mx-auto mb-2 max-w-3xl text-center text-xs text-gray-500">
              Study draft is created. Task generation will unlock next.
            </p>
          )}

          <form
            onSubmit={(e) => void handleSend(e)}
            className="mx-auto max-w-3xl"
          >
            <div
              className={`rounded-[28px] border border-blue-100/90 bg-white/95 shadow-sm backdrop-blur-md ${
                chatLocked ? "opacity-60" : ""
              }`}
            >
              {uploads.length > 0 && (
                <div className="flex flex-wrap gap-2 border-b border-gray-100 px-3 pt-3">
                  {uploads.map((f) => (
                    <div
                      key={f.id}
                      className="relative flex items-center gap-2 rounded-xl border border-blue-50 bg-blue-50/40 px-2 py-1.5 text-xs text-gray-600"
                    >
                      {f.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.previewUrl}
                          alt=""
                          className="size-9 rounded-md object-cover"
                        />
                      ) : (
                        <Paperclip className="size-3.5 text-blue-500" />
                      )}
                      <div className="min-w-0">
                        <p className="max-w-[140px] truncate font-medium text-gray-700">
                          {displayNameForUpload(f)}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {f.status === "uploading" && "Uploading…"}
                          {f.status === "ready" && "Ready"}
                          {f.status === "error" && (f.error || "Failed")}
                        </p>
                      </div>
                      {f.status === "uploading" && (
                        <Loader2 className="size-3.5 animate-spin text-blue-500" />
                      )}
                      {f.status === "ready" && (
                        <Check className="size-3.5 text-emerald-600" />
                      )}
                      {f.status === "error" && (
                        <AlertCircle className="size-3.5 text-red-500" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeUpload(f.id)}
                        disabled={sending || thinking}
                        className="cursor-pointer rounded p-0.5 text-gray-400 hover:bg-white hover:text-gray-700 disabled:cursor-not-allowed"
                        aria-label="Remove file"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                placeholder={
                  chatLocked
                    ? "Study created — task generation next…"
                    : uploadsBusy
                      ? "Uploading images… send unlocks when ready"
                      : "Message MindSurve…"
                }
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
                    <div className="absolute bottom-11 left-0 z-20 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
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
                        onClick={() => folderInputRef.current?.click()}
                      >
                        <FolderOpen className="size-4 text-blue-500" />
                        Upload folder
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {uploadsBusy && (
                    <span className="hidden text-[11px] text-gray-500 sm:inline">
                      Uploading {uploadingCount}…
                    </span>
                  )}
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
              Enter to send · Shift+Enter for a new line · Folder upload uses
              subfolders as categories
            </p>
          </form>
        </div>
      </main>
    </AppShell>
  )
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
          <AssistantMarkdown content={message.content} />
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
