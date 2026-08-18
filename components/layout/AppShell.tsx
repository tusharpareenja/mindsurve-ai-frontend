"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog"
import { RenameProjectDialog } from "@/components/project/RenameProjectDialog"
import { DeleteProjectDialog } from "@/components/project/DeleteProjectDialog"
import { RenameChatDialog } from "@/components/chat/RenameChatDialog"
import { DeleteChatDialog } from "@/components/chat/DeleteChatDialog"
import { MoveChatDialog } from "@/components/chat/MoveChatDialog"
import { useAuth } from "@/context/AuthContext"
import { useProjects } from "@/context/ProjectsContext"
import { useToast } from "@/components/feedback/Toaster"
import { cn } from "@/lib/utils"

const CreateProjectContext = createContext<(() => void) | null>(null)

export type ChatActionTarget = {
  id: string
  title: string
  projectId: string
}

type ChatActionsValue = {
  renameChat: (chat: ChatActionTarget) => void
  deleteChat: (chat: ChatActionTarget) => void
  moveChat: (chat: ChatActionTarget) => void
}

const ChatActionsContext = createContext<ChatActionsValue | null>(null)

export function useCreateProjectModal() {
  const open = useContext(CreateProjectContext)
  if (!open) {
    throw new Error("useCreateProjectModal must be used within AppShell")
  }
  return open
}

export function useChatActions() {
  const ctx = useContext(ChatActionsContext)
  if (!ctx) {
    throw new Error("useChatActions must be used within AppShell")
  }
  return ctx
}

type AppShellProps = {
  children: ReactNode
  selectedProjectId?: string
  selectedChatId?: string
  projectTitle?: string
  mainClassName?: string
}

export function AppShell({
  children,
  selectedProjectId,
  selectedChatId,
  projectTitle,
  mainClassName,
}: AppShellProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user, logout } = useAuth()
  const { projects, namedProjects } = useProjects()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [renameChatTarget, setRenameChatTarget] =
    useState<ChatActionTarget | null>(null)
  const [deleteChatTarget, setDeleteChatTarget] =
    useState<ChatActionTarget | null>(null)
  const [moveChatTarget, setMoveChatTarget] =
    useState<ChatActionTarget | null>(null)

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const openCreate = useCallback(() => {
    setSidebarOpen(false)
    setCreateOpen(true)
  }, [])
  const closeCreate = useCallback(() => setCreateOpen(false), [])

  const renameTarget = projects.find((p) => p.id === renameId)
  const deleteTarget = projects.find((p) => p.id === deleteId)
  const inboxProject = projects.find((p) => p.isInbox)

  const chatActions = useMemo<ChatActionsValue>(
    () => ({
      renameChat: (chat) => setRenameChatTarget(chat),
      deleteChat: (chat) => setDeleteChatTarget(chat),
      moveChat: (chat) => setMoveChatTarget(chat),
    }),
    []
  )

  // Desktop: keep expanded by default. Mobile: start collapsed (drawer overlay).
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) closeSidebar()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sidebarOpen, closeSidebar])

  const handleLogout = async () => {
    await logout()
    toast({
      type: "success",
      title: "Signed out",
      description: "See you next time.",
    })
    router.replace("/login")
  }

  return (
    <CreateProjectContext.Provider value={openCreate}>
      <ChatActionsContext.Provider value={chatActions}>
      <div className="relative h-dvh overflow-hidden bg-white">
        {/* Page-wide soft blue glow — sits above the white base, under UI */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[60%] bg-gradient-to-t from-blue-500/15 via-blue-500/5 to-transparent" />

        <Sidebar
          open={sidebarOpen}
          onOpen={openSidebar}
          onClose={closeSidebar}
          projects={namedProjects}
          allProjects={projects}
          selectedProjectId={selectedProjectId}
          selectedChatId={selectedChatId}
          onCreateProject={openCreate}
          onRenameProject={(id) => setRenameId(id)}
          onDeleteProject={(id) => setDeleteId(id)}
          onRenameChat={chatActions.renameChat}
          onDeleteChat={chatActions.deleteChat}
          onMoveChat={chatActions.moveChat}
          onLogout={handleLogout}
          userName={user?.name ?? "User"}
          userEmail={user?.email}
        />

        <div
          className={cn(
            "relative z-10 flex h-dvh flex-col overflow-hidden bg-transparent transition-[margin] duration-300 ease-out",
            sidebarOpen ? "lg:ml-72" : "lg:ml-14",
            mainClassName
          )}
        >
          <TopBar
            onOpenSidebar={openSidebar}
            sidebarOpen={sidebarOpen}
            title={projectTitle}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>

        <CreateProjectDialog
          open={createOpen}
          onClose={() => {
            closeCreate()
            setMoveChatTarget(null)
          }}
          moveChatId={moveChatTarget?.id}
        />

        <RenameProjectDialog
          open={!!renameId}
          projectId={renameId}
          currentTitle={renameTarget?.title}
          onClose={() => setRenameId(null)}
        />

        <DeleteProjectDialog
          open={!!deleteId}
          projectId={deleteId}
          projectTitle={deleteTarget?.title}
          onClose={() => setDeleteId(null)}
          onDeleted={(id) => {
            if (selectedProjectId === id) router.replace("/welcome")
          }}
        />

        <RenameChatDialog
          open={!!renameChatTarget}
          chatId={renameChatTarget?.id ?? null}
          currentTitle={renameChatTarget?.title}
          onClose={() => setRenameChatTarget(null)}
        />

        <DeleteChatDialog
          open={!!deleteChatTarget}
          chatId={deleteChatTarget?.id ?? null}
          chatTitle={deleteChatTarget?.title}
          onClose={() => setDeleteChatTarget(null)}
          onDeleted={(id) => {
            if (selectedChatId !== id) return
            const wasInbox =
              !!inboxProject && deleteChatTarget?.projectId === inboxProject.id
            router.replace(
              wasInbox || !deleteChatTarget?.projectId
                ? "/welcome"
                : `/project/${deleteChatTarget.projectId}`
            )
          }}
        />

        <MoveChatDialog
          open={!!moveChatTarget && !createOpen}
          chatId={moveChatTarget?.id ?? null}
          chatTitle={moveChatTarget?.title}
          currentProjectId={moveChatTarget?.projectId}
          onClose={() => setMoveChatTarget(null)}
          onCreateProject={() => setCreateOpen(true)}
          onMoved={(chatId, projectId) => {
            if (selectedChatId === chatId) {
              router.replace(`/project/${projectId}/chat/${chatId}`)
            }
          }}
        />
      </div>
    </ChatActionsContext.Provider>
    </CreateProjectContext.Provider>
  )
}
