"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Folder, Plus, Pencil, MessageSquare } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"
import { AuthGate } from "@/components/auth/AuthGate"
import { RenameProjectDialog } from "@/components/project/RenameProjectDialog"
import { Skeleton } from "@/components/feedback/Skeleton"
import { Input } from "@/components/ui/input"
import { useProjects } from "@/context/ProjectsContext"
import { useChats } from "@/context/ChatsContext"
import { useToast } from "@/components/feedback/Toaster"
import { formatRelativeDate } from "@/lib/formatters"
import { ApiError } from "@/lib/api/types"

export default function ProjectWorkspacePage() {
  return (
    <AuthGate requireAuth>
      <ProjectWorkspace />
    </AuthGate>
  )
}

function ProjectWorkspace() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { toast } = useToast()
  const { getProject, isLoading, refresh } = useProjects()
  const { getChatsForProject, getPreview, startChatWithMessage, createChat } =
    useChats()
  const [draft, setDraft] = useState("")
  const [renameOpen, setRenameOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const project = getProject(projectId)
  const chats = getChatsForProject(projectId)

  // Re-sync when landing on a project (covers create → navigate)
  useEffect(() => {
    void refresh()
  }, [projectId, refresh])

  useEffect(() => {
    if (isLoading) return
    if (project) return
    const t = window.setTimeout(() => {
      void refresh().then(() => {
        if (!getProject(projectId)) {
          router.replace("/welcome")
        }
      })
    }, 300)
    return () => window.clearTimeout(t)
  }, [isLoading, project, projectId, getProject, refresh, router])

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const { chat } = await startChatWithMessage(projectId, content)
      setDraft("")
      router.push(`/project/${projectId}/chat/${chat.id}`)
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't start chat",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setSending(false)
    }
  }

  const handleEmptyNewChat = async () => {
    if (sending) return
    setSending(true)
    try {
      const chat = await createChat(projectId, "New Chat")
      router.push(`/project/${projectId}/chat/${chat.id}`)
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't start chat",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
      setSending(false)
    }
  }

  if (isLoading || !project) {
    return (
      <AppShell selectedProjectId={projectId}>
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell selectedProjectId={projectId} projectTitle={project.title}>
      <main className="flex flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {/* Project header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-3 flex items-center gap-2">
              <Folder className="size-6 text-blue-500" />
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                {project.title}
              </h1>
              <button
                type="button"
                onClick={() => setRenameOpen(true)}
                className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Rename project"
              >
                <Pencil className="size-4" />
              </button>
            </div>
          </div>

          {/* New chat composer — first message creates a Chat */}
          <form
            onSubmit={(e) => void handleStartChat(e)}
            className="mb-8"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-blue-100/80 bg-white/70 p-2 shadow-sm backdrop-blur-md">
              <button
                type="button"
                onClick={() => void handleEmptyNewChat()}
                className="cursor-pointer shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/80 hover:text-gray-600"
                aria-label="Start empty chat"
              >
                <Plus className="size-5" />
              </button>
              <Input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`New chat in ${project.title}`}
                className="flex-1 border-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus-visible:ring-0"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="cursor-pointer shrink-0 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                Send
              </button>
            </div>
          </form>

          {/* Chats list */}
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              Chats
            </span>
          </div>

          {chats.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Send a message above to start your first chat in this project.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {chats.map((chat) => {
                const preview = getPreview(chat.id)
                return (
                  <li key={chat.id}>
                    <Link
                      href={`/project/${projectId}/chat/${chat.id}`}
                      className="cursor-pointer flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                    >
                      <MessageSquare className="mt-0.5 size-4 shrink-0 text-gray-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {chat.title}
                          </p>
                          <span className="shrink-0 text-xs text-gray-400">
                            {formatRelativeDate(chat.updatedAt)}
                          </span>
                        </div>
                        {preview && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {preview}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>

      <RenameProjectDialog
        open={renameOpen}
        projectId={projectId}
        currentTitle={project.title}
        onClose={() => setRenameOpen(false)}
      />
    </AppShell>
  )
}
