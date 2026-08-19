"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowUp,
  Check,
  FileText,
  FolderOpen,
  ImageIcon,
  ImagePlus,
  Layers,
  Loader2,
  Paperclip,
  Plus,
  Sparkles,
  X,
} from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { AuthGate } from "@/components/auth/AuthGate"
import { Skeleton } from "@/components/feedback/Skeleton"
import { SpeechToTextButton } from "@/components/chat/SpeechToTextButton"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { useChats } from "@/context/ChatsContext"
import { useProjects } from "@/context/ProjectsContext"
import { useToast } from "@/components/feedback/Toaster"
import { useSpeechToText } from "@/hooks/use-speech-to-text"
import { DEFAULT_GREETING, getGreeting, type Greeting } from "@/lib/greeting"
import { ApiError } from "@/lib/api/types"
import { studyBriefApi } from "@/lib/api/studyBrief"
import { generateChatTitle } from "@/lib/chat-title"
import {
  displayNameForUpload,
  filesFromClipboard,
  filesFromDataTransfer,
  mapPool,
  parseUploadSelection,
  type UploadItem,
} from "@/lib/chat-uploads"
import type { AttachmentBrief } from "@/types/study-brief"
import { cn } from "@/lib/utils"

const UPLOAD_CONCURRENCY = 4

const SUGGESTIONS = [
  {
    icon: FileText,
    label: "Text study",
    prompt:
      "Build a text study to test campaign messages and openings for my idea.",
  },
  {
    icon: ImageIcon,
    label: "Logo / visual test",
    prompt:
      "I want a grid study to test logo and visual options with respondents.",
  },
  {
    icon: Sparkles,
    label: "Upload a brief later",
    prompt:
      "Help me set up a MindSurve study. I’ll describe the idea first, then upload a PDF or Word brief if needed.",
  },
] as const

export default function WelcomePage() {
  return (
    <AuthGate requireAuth>
      <WelcomeShell />
    </AuthGate>
  )
}

function WelcomeShell() {
  const { user } = useAuth()
  const { isLoading, ensureInbox } = useProjects()

  useEffect(() => {
    if (isLoading) return
    void ensureInbox().catch(() => {
      /* inbox is created on first send if this fails */
    })
  }, [isLoading, ensureInbox])

  return (
    <AppShell>
      {isLoading ? (
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <Skeleton className="h-10 w-64 sm:w-80" />
          <Skeleton className="mt-4 h-4 w-48" />
          <Skeleton className="mt-8 h-28 w-full max-w-2xl rounded-3xl" />
        </main>
      ) : (
        <WelcomeMain userName={user?.name?.split(" ")[0] || "there"} />
      )}
    </AppShell>
  )
}

function WelcomeMain({ userName }: { userName: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const {
    startHomeChat,
    createChat,
    renameChat,
    refresh: refreshChats,
  } = useChats()
  const { ensureInbox, refresh: refreshProjects } = useProjects()
  const [greeting, setGreeting] = useState<Greeting>(DEFAULT_GREETING)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [layerStudyEnabled, setLayerStudyEnabled] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const sendingLock = useRef(false)
  const draftChatRef = useRef<{ chatId: string; projectId: string } | null>(
    null
  )
  const draftChatPromiseRef = useRef<Promise<{
    chatId: string
    projectId: string
  }> | null>(null)

  const readyUploads = uploads.filter((u) => u.status === "ready" && u.url)
  const uploadsBusy = uploads.some((u) => u.status === "uploading")
  const hasUploadErrors = uploads.some((u) => u.status === "error")
  const canSend =
    (draft.trim().length > 0 || readyUploads.length > 0) &&
    !sending &&
    !uploadsBusy &&
    !hasUploadErrors

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

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft])

  useEffect(() => {
    const folderInput = folderInputRef.current
    if (!folderInput) return
    folderInput.setAttribute("webkitdirectory", "")
    folderInput.setAttribute("directory", "")
  }, [])

  useEffect(() => {
    if (!attachMenuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!attachMenuRef.current?.contains(event.target as Node)) {
        setAttachMenuOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [attachMenuOpen])

  useEffect(() => {
    return () => {
      for (const item of uploads) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }, [])

  const ensureDraftChat = useCallback(async () => {
    if (draftChatRef.current) return draftChatRef.current
    if (draftChatPromiseRef.current) return draftChatPromiseRef.current

    draftChatPromiseRef.current = (async () => {
      const inbox = await ensureInbox()
      const chat = await createChat(inbox.id)
      const ref = { chatId: chat.id, projectId: chat.projectId }
      draftChatRef.current = ref
      return ref
    })()

    try {
      return await draftChatPromiseRef.current
    } finally {
      draftChatPromiseRef.current = null
    }
  }, [createChat, ensureInbox])

  const uploadOne = useCallback(
    async (chatId: string, item: UploadItem) => {
      try {
        if (item.file.size > 25 * 1024 * 1024) {
          throw new Error("File exceeds 25 MB")
        }
        const uploaded = await studyBriefApi.upload(chatId, item.file, {
          category: item.category,
          relativePath: item.relativePath,
          isBackground: item.isBackground,
          layerOrder: item.layerOrder,
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
            description: `We uploaded ${item.file.name}, but couldn't extract its text.`,
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
    [toast]
  )

  const startUploads = useCallback(
    async (incoming: UploadItem[]) => {
      if (!incoming.length) return
      setUploads((prev) => [...prev, ...incoming])
      try {
        const { chatId } = await ensureDraftChat()
        await mapPool(incoming, UPLOAD_CONCURRENCY, (item) =>
          uploadOne(chatId, item)
        )
      } catch (err) {
        toast({
          type: "error",
          title: "Couldn't start uploads",
          description:
            err instanceof ApiError ? err.message : "Please try again.",
        })
        setUploads((prev) =>
          prev.map((u) =>
            incoming.some((i) => i.id === u.id) && u.status === "uploading"
              ? { ...u, status: "error", error: "Upload failed" }
              : u
          )
        )
      }
    },
    [ensureDraftChat, toast, uploadOne]
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
    try {
      const { chatId } = await ensureDraftChat()
      await mapPool(failed, UPLOAD_CONCURRENCY, (item) =>
        uploadOne(chatId, { ...item, status: "uploading" })
      )
    } catch {
      /* uploadOne sets per-file errors */
    }
  }, [ensureDraftChat, uploadOne, uploads])

  const handlePickFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files || (Array.isArray(files) ? !files.length : !files.length)) return
      setAttachMenuOpen(false)
      const parsed = parseUploadSelection(files, {
        layerStudy: layerStudyEnabled ? true : undefined,
      })

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
      if (parsed.detectedLayerStudy) {
        setLayerStudyEnabled(true)
        toast({
          type: "info",
          title: "Layer study folder detected",
          description: `Background + ${parsed.layerCount} layer${parsed.layerCount === 1 ? "" : "s"} — uploading now.`,
        })
      }
      for (const warning of parsed.warnings) {
        toast({
          type: "warning",
          title: "Folder import note",
          description: warning,
        })
      }
      if (parsed.skippedUnsupported > 0 && !parsed.detectedLayerStudy) {
        toast({
          type: "info",
          title: "Some files skipped",
          description: `${parsed.skippedUnsupported} unsupported file(s) were ignored.`,
        })
      }

      const next: UploadItem[] = parsed.items.map((item) => ({
        ...item,
        status: "uploading" as const,
      }))
      void startUploads(next)
    },
    [layerStudyEnabled, startUploads, toast]
  )

  const handlePasteFiles = useCallback(
    (event: React.ClipboardEvent) => {
      if (sending) return
      const files = filesFromClipboard(event.clipboardData)
      if (!files.length) return
      event.preventDefault()
      handlePickFiles(files)
    },
    [handlePickFiles, sending]
  )

  const handleDropFiles = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setDragActive(false)
      if (sending) return
      try {
        const files = await filesFromDataTransfer(event.dataTransfer)
        if (!files.length) {
          toast({
            type: "warning",
            title: "Nothing to upload",
            description: "Drop images, a PDF/Word file, or a folder of images.",
          })
          return
        }
        handlePickFiles(files)
      } catch {
        toast({
          type: "error",
          title: "Couldn't read dropped files",
          description: "Please try again or use the + menu.",
        })
      }
    },
    [handlePickFiles, sending, toast]
  )

  const submit = async (raw?: string) => {
    const content = (raw ?? draft).trim()
    if (
      (!content && readyUploads.length === 0) ||
      sending ||
      sendingLock.current ||
      uploadsBusy ||
      hasUploadErrors
    ) {
      return
    }

    sendingLock.current = true
    setSending(true)
    speech.stop()

    const messageContent =
      content ||
      (readyUploads.length
        ? `Uploaded ${readyUploads.length} file(s)`
        : "")

    try {
      let chatId: string
      let projectId: string
      const titleSeed =
        content ||
        (readyUploads.length === 1
          ? readyUploads[0].file.name
          : `Uploaded ${readyUploads.length} files`)

      if (readyUploads.length > 0) {
        const draftChat = draftChatRef.current ?? (await ensureDraftChat())
        chatId = draftChat.chatId
        projectId = draftChat.projectId
        const attachments: AttachmentBrief[] = readyUploads.map((u) => ({
          url: u.url!,
          filename: u.file.name,
          content_type:
            u.contentType || u.file.type || "application/octet-stream",
          category: u.category ?? null,
          relative_path: u.relativePath ?? null,
          extracted_text: u.extractedText ?? null,
          is_background: u.isBackground ?? false,
          layer_order: typeof u.layerOrder === "number" ? u.layerOrder : null,
        }))
        await studyBriefApi.aiTurn(chatId, messageContent, attachments)
        void generateChatTitle(titleSeed).then(async (title) => {
          try {
            await renameChat(chatId, title)
          } catch {
            /* best-effort */
          }
        })
      } else {
        const { chat } = await startHomeChat(content)
        chatId = chat.id
        projectId = chat.projectId
      }

      for (const item of uploads) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      }
      setUploads([])
      setDraft("")
      draftChatRef.current = null

      await Promise.all([refreshProjects(), refreshChats()])
      router.push(`/project/${projectId}/chat/${chatId}`)
    } catch (err) {
      toast({
        type: "error",
        title:
          readyUploads.length > 0
            ? "Couldn't start study chat"
            : "Couldn't start chat",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      if (!readyUploads.length) setDraft(content)
      sendingLock.current = false
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-blue-500/10 via-blue-500/5 to-transparent" />

      <div className="relative z-[1] mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
        <div className="text-center animate-in fade-in-0 slide-in-from-bottom-3 duration-700">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/25 sm:size-14">
            <Sparkles className="size-5 sm:size-6" />
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
            {greeting.pre}{" "}
            <span className="text-blue-500">{userName}</span>
            {greeting.post}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500 sm:text-base">
            Give us your idea. We handle the rest — no project required to start.
          </p>
        </div>

        <form
          className="mt-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-700 fill-mode-both"
          style={{ animationDelay: "80ms" }}
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div
            className={cn(
              "relative rounded-[1.75rem] border border-gray-200/90 bg-white/95 p-3 shadow-[0_18px_50px_-28px_rgba(37,99,235,0.45)] backdrop-blur-sm transition-shadow",
              "focus-within:border-blue-300 focus-within:shadow-[0_22px_55px_-24px_rgba(37,99,235,0.55)]",
              speech.listening && "border-red-200 ring-2 ring-red-100",
              dragActive && "border-blue-400 ring-2 ring-blue-100"
            )}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!sending) setDragActive(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!sending) setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (e.currentTarget.contains(e.relatedTarget as Node)) return
              setDragActive(false)
            }}
            onDrop={(e) => {
              void handleDropFiles(e)
            }}
          >
            {dragActive && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[1.75rem] bg-blue-50/90">
                <p className="text-sm font-medium text-blue-700">
                  Drop images, PDF/Word, or a folder to upload
                </p>
              </div>
            )}
            {uploads.length > 0 && (
              <div className="mb-2 border-b border-gray-100 pb-2">
                <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                  <span className="text-[11px] font-medium text-gray-500">
                    {readyUploads.length}/{uploads.length} ready
                    {hasUploadErrors ? " · some failed" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    {hasUploadErrors && (
                      <button
                        type="button"
                        onClick={() => void retryFailedUploads()}
                        disabled={sending || uploadsBusy}
                        className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Retry failed
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        for (const item of uploads) removeUpload(item.id)
                      }}
                      disabled={sending}
                      className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto sm:max-h-32 sm:gap-2">
                  {uploads.map((item) => (
                    <div
                      key={item.id}
                      className="relative flex min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-blue-50 bg-blue-50/40 px-1.5 py-1 text-xs text-gray-600 sm:gap-2 sm:px-2 sm:py-1.5"
                    >
                      {item.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="size-8 shrink-0 rounded-md object-cover sm:size-9"
                        />
                      ) : (
                        <Paperclip className="size-3.5 shrink-0 text-blue-500" />
                      )}
                      <div className="min-w-0">
                        <p className="max-w-[96px] truncate font-medium text-gray-700 sm:max-w-[140px]">
                          {displayNameForUpload(item)}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {item.status === "uploading" && "Uploading…"}
                          {item.status === "ready" && "Ready"}
                          {item.status === "error" && (item.error || "Failed")}
                        </p>
                      </div>
                      {item.status === "uploading" && (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-blue-500" />
                      )}
                      {item.status === "ready" && (
                        <Check className="size-3.5 shrink-0 text-emerald-600" />
                      )}
                      {item.status === "error" && (
                        <AlertCircle className="size-3.5 shrink-0 text-red-500" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeUpload(item.id)}
                        disabled={sending}
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

            <label htmlFor="home-composer" className="sr-only">
              Start a study chat
            </label>
            <textarea
              id="home-composer"
              ref={textareaRef}
              rows={2}
              value={draft}
              disabled={sending}
              onChange={(e) => {
                if (speech.listening) speech.stop()
                setDraft(e.target.value)
              }}
              onKeyDown={onKeyDown}
              onPaste={handlePasteFiles}
              placeholder="How can MindSurve help you today?"
              className="max-h-40 min-h-[3.25rem] w-full resize-none bg-transparent px-2 py-1.5 text-base text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-1 flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                disabled={sending}
                onClick={() => setLayerStudyEnabled((on) => !on)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  layerStudyEnabled
                    ? "bg-blue-500 text-white shadow-sm shadow-blue-500/25"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                )}
                aria-pressed={layerStudyEnabled}
                title={
                  layerStudyEnabled
                    ? "Layer study on — folder uploads map to background + layers"
                    : "Turn on for a layer study (background + layer folders)"
                }
              >
                <Layers className="size-3.5" />
                Layer study
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <div ref={attachMenuRef} className="relative">
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
                    disabled={sending}
                    onClick={() => setAttachMenuOpen((open) => !open)}
                    className="inline-flex cursor-pointer items-center rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Add attachment"
                  >
                    <Plus className="size-5" />
                  </button>
                  {attachMenuOpen && (
                    <div className="absolute bottom-11 right-0 z-20 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
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
                <SpeechToTextButton
                  listening={speech.listening}
                  supported={speech.supported}
                  disabled={sending}
                  onToggle={() => speech.toggle(draft)}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!canSend}
                  className="size-10 cursor-pointer rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed"
                  aria-label="Start chat"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            + for images, folders, or PDF / Word · Paste or drag & drop · Tap Layer study for layered packs
          </p>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 animate-in fade-in-0 duration-700 fill-mode-both"
          style={{ animationDelay: "140ms" }}
        >
          {SUGGESTIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={sending}
              onClick={() => {
                setDraft(item.prompt)
                void submit(item.prompt)
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              <item.icon className="size-3.5 shrink-0 text-blue-500" />
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Want folders later? Hover{" "}
          <span className="font-medium text-gray-500">Projects</span> in the
          sidebar and tap +.
        </p>
      </div>
    </main>
  )
}
