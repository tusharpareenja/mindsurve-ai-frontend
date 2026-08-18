"use client"

import { useEffect, useMemo, useState } from "react"
import { FolderPlus } from "lucide-react"
import { Dialog } from "@/components/feedback/Dialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { useChats } from "@/context/ChatsContext"
import { useProjects } from "@/context/ProjectsContext"
import { ApiError } from "@/lib/api/types"
import { cn } from "@/lib/utils"

type MoveChatDialogProps = {
  open: boolean
  chatId: string | null
  chatTitle?: string
  currentProjectId?: string | null
  onClose: () => void
  onCreateProject?: () => void
  onMoved?: (chatId: string, projectId: string) => void
}

export function MoveChatDialog({
  open,
  chatId,
  chatTitle,
  currentProjectId,
  onClose,
  onCreateProject,
  onMoved,
}: MoveChatDialogProps) {
  const { moveChat } = useChats()
  const { namedProjects, inboxProject } = useProjects()
  const { toast } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedId(null)
      setSubmitting(false)
    }
  }, [open, chatId])

  const destinations = useMemo(() => {
    const named = namedProjects.filter((p) => p.id !== currentProjectId)
    const canMoveToInbox = Boolean(
      inboxProject && inboxProject.id !== currentProjectId
    )
    return { named, canMoveToInbox }
  }, [namedProjects, inboxProject, currentProjectId])

  const handleMove = async () => {
    if (!chatId || !selectedId || submitting) return
    setSubmitting(true)
    try {
      const updated = await moveChat(chatId, selectedId)
      if (!updated) {
        toast({
          type: "error",
          title: "Couldn't move chat",
          description: "This chat may no longer exist.",
        })
        return
      }
      const dest =
        namedProjects.find((p) => p.id === selectedId)?.title ||
        (inboxProject?.id === selectedId ? "Personal chats" : "that project")
      toast({
        type: "success",
        title: "Chat moved",
        description: `“${chatTitle || "Chat"}” is now in ${dest}.`,
      })
      onMoved?.(chatId, selectedId)
      setSelectedId(null)
      onClose()
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't move chat",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add to project">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose where{" "}
          <span className="font-medium text-gray-900">
            {chatTitle ? `“${chatTitle}”` : "this chat"}
          </span>{" "}
          should live.
        </p>

        {destinations.named.length === 0 && !destinations.canMoveToInbox ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
            You don’t have a project yet. Create one, then add this chat to it.
          </p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {destinations.named.map((project) => {
              const selected = selectedId === project.id
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(project.id)}
                    className={cn(
                      "cursor-pointer flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selected
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-gray-800 hover:bg-gray-50"
                    )}
                  >
                    {project.title}
                  </button>
                </li>
              )
            })}
            {destinations.canMoveToInbox && inboxProject ? (
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedId(inboxProject.id)}
                  className={cn(
                    "cursor-pointer flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selectedId === inboxProject.id
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-gray-800 hover:bg-gray-50"
                  )}
                >
                  Personal chats
                </button>
              </li>
            ) : null}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {onCreateProject ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCreateProject()}
              disabled={submitting}
              className="cursor-pointer border-blue-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed sm:flex-1"
            >
              <FolderPlus className="size-3.5" />
              New project
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed sm:flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleMove()}
            disabled={submitting || !selectedId}
            className="cursor-pointer bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed sm:flex-1"
          >
            {submitting ? "Moving…" : "Move"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
