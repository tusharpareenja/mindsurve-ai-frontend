"use client"

import { useState } from "react"
import { Dialog } from "@/components/feedback/Dialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { useProjects } from "@/context/ProjectsContext"
import { useChats } from "@/context/ChatsContext"
import { ApiError } from "@/lib/api/types"

type DeleteProjectDialogProps = {
  open: boolean
  projectId: string | null
  projectTitle?: string
  onClose: () => void
  onDeleted?: (id: string) => void
}

export function DeleteProjectDialog({
  open,
  projectId,
  projectTitle,
  onClose,
  onDeleted,
}: DeleteProjectDialogProps) {
  const { deleteProject } = useProjects()
  const { clearProjectChats } = useChats()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const handleDelete = async () => {
    if (!projectId || submitting) return
    setSubmitting(true)
    try {
      const ok = await deleteProject(projectId)
      if (!ok) {
        toast({
          type: "error",
          title: "Couldn't delete project",
          description: "This project may no longer exist.",
        })
        return
      }
      clearProjectChats(projectId)
      toast({
        type: "success",
        title: "Project deleted",
        description: projectTitle
          ? `“${projectTitle}” was removed.`
          : "The project was removed.",
      })
      onDeleted?.(projectId)
      onClose()
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't delete project",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Delete Project">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{" "}
          <span className="font-medium text-gray-900">
            {projectTitle ? `“${projectTitle}”` : "this project"}
          </span>
          ? This can’t be undone.
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 cursor-pointer border-blue-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleDelete()}
            disabled={submitting}
            className="flex-1 cursor-pointer bg-red-500 text-white hover:bg-red-600 disabled:cursor-not-allowed"
          >
            {submitting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
