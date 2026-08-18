"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "@/components/feedback/Dialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useChats } from "@/context/ChatsContext"
import { useProjects } from "@/context/ProjectsContext"
import { ApiError } from "@/lib/api/types"

type CreateProjectDialogProps = {
  open: boolean
  onClose: () => void
  /** If set, the new project receives this chat instead of a blank one. */
  moveChatId?: string | null
}

/** Single shared modal for creating a beginner project — title only. */
export function CreateProjectDialog({
  open,
  onClose,
  moveChatId,
}: CreateProjectDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { createProject } = useProjects()
  const { createChat, moveChat } = useChats()
  const [title, setTitle] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setTitle("")
    setSubmitting(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()

    if (!trimmed) {
      toast({
        type: "error",
        title: "Project title required",
        description: "Please enter a name for your project.",
      })
      return
    }

    setSubmitting(true)
    try {
      const newProject = await createProject(trimmed)
      let destination = `/project/${newProject.id}`
      if (moveChatId) {
        const moved = await moveChat(moveChatId, newProject.id)
        if (moved) {
          destination = `/project/${newProject.id}/chat/${moved.id}`
        }
      } else {
        try {
          const chat = await createChat(newProject.id, "New Chat")
          destination = `/project/${newProject.id}/chat/${chat.id}`
        } catch {
          // Project exists; land on the project hub if chat creation fails.
        }
      }
      toast({
        type: "success",
        title: "Project created",
        description: `"${newProject.title}" is ready.`,
      })
      resetForm()
      onClose()
      // Hard navigate from wherever the user currently is (welcome / other project / chat).
      router.replace(destination)
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't create project",
        description:
          err instanceof ApiError
            ? err.message
            : "Please try again in a moment.",
      })
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (submitting) return
        resetForm()
        onClose()
      }}
      title="Create New Project"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="project-title" className="text-gray-900">
            Project Title
          </Label>
          <Input
            id="project-title"
            name="title"
            type="text"
            placeholder="Enter project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="cursor-text border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
            autoFocus
            required
            disabled={submitting}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm()
              onClose()
            }}
            disabled={submitting}
            className="flex-1 cursor-pointer border-blue-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="flex-1 cursor-pointer bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating…" : "Create Project"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
