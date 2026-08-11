"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog"
import { RenameProjectDialog } from "@/components/project/RenameProjectDialog"
import { DeleteProjectDialog } from "@/components/project/DeleteProjectDialog"
import { useAuth } from "@/context/AuthContext"
import { useProjects } from "@/context/ProjectsContext"
import { useToast } from "@/components/feedback/Toaster"
import { cn } from "@/lib/utils"

const CreateProjectContext = createContext<(() => void) | null>(null)

export function useCreateProjectModal() {
  const open = useContext(CreateProjectContext)
  if (!open) {
    throw new Error("useCreateProjectModal must be used within AppShell")
  }
  return open
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
  const { projects } = useProjects()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const openCreate = useCallback(() => setCreateOpen(true), [])
  const closeCreate = useCallback(() => setCreateOpen(false), [])

  const renameTarget = projects.find((p) => p.id === renameId)
  const deleteTarget = projects.find((p) => p.id === deleteId)

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
      <div className="relative h-dvh overflow-hidden bg-white">
        {/* Page-wide soft blue glow — sits above the white base, under UI */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[60%] bg-gradient-to-t from-blue-500/15 via-blue-500/5 to-transparent" />

        <Sidebar
          open={sidebarOpen}
          onOpen={openSidebar}
          onClose={closeSidebar}
          projects={projects}
          selectedProjectId={selectedProjectId}
          selectedChatId={selectedChatId}
          onCreateProject={openCreate}
          onRenameProject={(id) => setRenameId(id)}
          onDeleteProject={(id) => setDeleteId(id)}
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

        <CreateProjectDialog open={createOpen} onClose={closeCreate} />

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
      </div>
    </CreateProjectContext.Provider>
  )
}
