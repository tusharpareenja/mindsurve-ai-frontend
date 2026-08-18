"use client"

import { useEffect, useState } from "react"
import { Dialog } from "@/components/feedback/Dialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useChats } from "@/context/ChatsContext"
import { ApiError } from "@/lib/api/types"

type RenameChatDialogProps = {
  open: boolean
  chatId: string | null
  currentTitle?: string
  onClose: () => void
}

export function RenameChatDialog({
  open,
  chatId,
  currentTitle = "",
  onClose,
}: RenameChatDialogProps) {
  const { renameChat } = useChats()
  const { toast } = useToast()
  const [title, setTitle] = useState(currentTitle)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(currentTitle)
      setSubmitting(false)
    }
  }, [open, currentTitle])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatId) return
    const trimmed = title.trim()
    if (!trimmed) {
      toast({
        type: "error",
        title: "Title required",
        description: "Please enter a chat name.",
      })
      return
    }

    setSubmitting(true)
    try {
      const updated = await renameChat(chatId, trimmed)
      if (!updated) {
        toast({
          type: "error",
          title: "Couldn't rename chat",
          description: "This chat may no longer exist.",
        })
        return
      }
      toast({
        type: "success",
        title: "Chat renamed",
        description: `Updated to “${updated.title}”.`,
      })
      onClose()
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't rename chat",
        description:
          err instanceof ApiError ? err.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Rename chat">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rename-chat-title">Chat name</Label>
          <Input
            id="rename-chat-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a chat name"
            className="border-gray-300 bg-white text-gray-900"
            autoFocus
            required
            disabled={submitting}
          />
        </div>
        <div className="flex gap-3 pt-1">
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
            type="submit"
            disabled={submitting}
            className="flex-1 cursor-pointer bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
