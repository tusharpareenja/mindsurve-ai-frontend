"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UserRound } from "lucide-react"
import { Dialog } from "@/components/feedback/Dialog"
import { useToast } from "@/components/feedback/Toaster"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useChats } from "@/context/ChatsContext"
import { useProjects } from "@/context/ProjectsContext"
import {
  projectsApi,
  type CollaboratorDto,
} from "@/lib/api/projects"
import { ApiError } from "@/lib/api/types"

type InviteCollaboratorDialogProps = {
  open: boolean
  onClose: () => void
  /** Named project invite. */
  projectId?: string | null
  projectTitle?: string
  /** Personal/inbox chat invite — promotes into a project on send. */
  chatId?: string | null
  chatTitle?: string
  fromInbox?: boolean
}

export function InviteCollaboratorDialog({
  open,
  onClose,
  projectId: initialProjectId,
  projectTitle,
  chatId,
  chatTitle,
  fromInbox = false,
}: InviteCollaboratorDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { refresh: refreshProjects } = useProjects()
  const { refresh: refreshChats } = useChats()
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [members, setMembers] = useState<CollaboratorDto[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [membersError, setMembersError] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    initialProjectId ?? null
  )

  const loadMembers = useCallback(async (id: string) => {
    setLoadingMembers(true)
    setMembersError(false)
    try {
      const rows = await projectsApi.listCollaborators(id)
      setMembers(rows)
    } catch {
      setMembersError(true)
      setMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setEmail("")
      setSubmitting(false)
      setMembers([])
      setMembersError(false)
      setActiveProjectId(null)
      return
    }
    const pid = initialProjectId && !fromInbox ? initialProjectId : null
    setActiveProjectId(pid)
    if (pid) {
      void loadMembers(pid)
    } else {
      setMembers([])
      setLoadingMembers(false)
      setMembersError(false)
    }
  }, [open, initialProjectId, fromInbox, loadMembers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      toast({
        type: "error",
        title: "Email required",
        description: "Enter the email address of the person you’d like to invite.",
      })
      return
    }

    setSubmitting(true)
    try {
      const result =
        fromInbox && chatId
          ? await projectsApi.inviteChatCollaborator(chatId, trimmed)
          : await projectsApi.inviteCollaborator(
              activeProjectId || initialProjectId || "",
              trimmed
            )

      toast({
        type: "success",
        title: result.promoted_from_inbox
          ? "Chat shared"
          : "Collaborator invited",
        description: result.message,
      })
      if (result.promoted_from_inbox && result.project_id && chatId) {
        await Promise.all([refreshProjects(), refreshChats()])
        onClose()
        router.replace(`/project/${result.project_id}/chat/${chatId}`)
        return
      }
      setEmail("")
      const nextProjectId = result.project_id || activeProjectId || initialProjectId
      if (nextProjectId) {
        setActiveProjectId(nextProjectId)
        await loadMembers(nextProjectId)
      }
    } catch (err) {
      toast({
        type: "error",
        title: "Couldn't send invite",
        description:
          err instanceof ApiError
            ? err.message
            : "Please try again in a moment.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const shareLabel = fromInbox
    ? chatTitle
      ? `“${chatTitle}”`
      : "this chat"
    : projectTitle
      ? `“${projectTitle}”`
      : "this project"

  const membersProjectId = activeProjectId || (!fromInbox ? initialProjectId : null)

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (submitting) return
        onClose()
      }}
      title="Add collaborator"
      className="max-w-lg"
    >
      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Invite someone to edit {shareLabel}
            {fromInbox
              ? ". We’ll create a shared project for this chat so they can work with you."
              : ", including its chats and studies."}
          </p>

          <div className="space-y-2">
            <Label htmlFor="collaborator-email" className="text-gray-900">
              Email
            </Label>
            <Input
              id="collaborator-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="cursor-text border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
              autoFocus
              required
              disabled={submitting}
            />
          </div>

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
              type="submit"
              disabled={submitting}
              className="flex-1 cursor-pointer bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            People with access
          </h3>

          {!membersProjectId ? (
            <p className="py-2 text-sm text-gray-500">
              Only you have access so far. After you invite someone, this chat
              becomes a shared project.
            </p>
          ) : loadingMembers ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" />
              Loading collaborators…
            </div>
          ) : membersError ? (
            <div className="space-y-2 py-1">
              <p className="text-sm text-gray-500">
                We couldn’t load collaborators right now.
              </p>
              <button
                type="button"
                onClick={() =>
                  membersProjectId && void loadMembers(membersProjectId)
                }
                className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          ) : members.length === 0 ? (
            <p className="py-2 text-sm text-gray-500">
              Only you have access so far.
            </p>
          ) : (
            <ul className="max-h-52 space-y-1 overflow-y-auto">
              {members.map((member) => {
                const label =
                  member.name?.trim() ||
                  member.email ||
                  "Collaborator"
                const statusLabel = member.is_owner
                  ? "Owner"
                  : member.status === "pending"
                    ? "Invite pending"
                    : "Collaborator"
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <UserRound className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {label}
                      </p>
                      {member.name?.trim() && member.email ? (
                        <p className="truncate text-xs text-gray-500">
                          {member.email}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {statusLabel}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  )
}
