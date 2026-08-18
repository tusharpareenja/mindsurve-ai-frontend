"use client"

import { useState } from "react"
import { Dialog } from "@/components/feedback/Dialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { useChats } from "@/context/ChatsContext"
import { ApiError } from "@/lib/api/types"

type DeleteChatDialogProps = {
  open: boolean
  chatId: string | null
  chatTitle?: string
  onClose: () => void
  onDeleted?: (id: string) => void
}

export function DeleteChatDialog({
  open,
  chatId,
  chatTitle,
  onClose,
  onDeleted,
}: DeleteChatDialogProps) {
  const { deleteChat } = useChats()
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const handleDelete = async () => {
    if (!chatId || submitting) return
    setSubmitting(true)
    try {
      const ok = await deleteChat(chatId)
      if (!ok) {
        toast({
          type: "error",
          title: "Couldn't delete chat",
          description: "This chat may no longer exist.",
        })
        return
      }
      toast({
        type: "success",
        title: "Chat deleted",
        description: chatTitle
          ? `“${chatTitle}” was removed.`
          : "The chat was removed.",
      })
      onDeleted?.(chatId)
      onClose()
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't delete chat",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Delete chat">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{" "}
          <span className="font-medium text-gray-900">
            {chatTitle ? `“${chatTitle}”` : "this chat"}
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
