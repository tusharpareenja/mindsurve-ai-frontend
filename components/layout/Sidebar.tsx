"use client"

import { useRouter } from "next/navigation"
import {
  Plus,
  PanelLeft,
  PanelLeftClose,
  Settings,
  BookText,
  Sparkles,
  Megaphone,
  Power,
  Search,
  SquarePen,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronRight,
  Folder,
  MessageSquare,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { Project } from "@/types"
import { BrandName } from "@/components/brand/BrandName"
import { EmptyState } from "@/components/feedback/EmptyState"
import { useChats } from "@/context/ChatsContext"
import { useToast } from "@/components/feedback/Toaster"
import { cn } from "@/lib/utils"

type SidebarProps = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  projects?: Project[]
  selectedProjectId?: string
  selectedChatId?: string
  onCreateProject?: () => void
  onRenameProject?: (id: string) => void
  onDeleteProject?: (id: string) => void
  onLogout?: () => void
  userName?: string
  userEmail?: string
}

export const SIDEBAR_RAIL_WIDTH = "w-14"
export const SIDEBAR_EXPANDED_WIDTH = "w-72"

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function Sidebar({
  open,
  onOpen,
  onClose,
  projects = [],
  selectedProjectId,
  selectedChatId,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onLogout,
  userName = "Your Name",
  userEmail,
}: SidebarProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { getChatsForProject, createChat } = useChats()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const comingSoon = (feature: string) => {
    toast({
      type: "info",
      title: "Coming soon",
      description: `${feature} will be available in a later update.`,
    })
  }

  // Auto-expand the active project so its chats are visible
  useEffect(() => {
    if (!selectedProjectId) return
    setExpandedIds((prev) => {
      if (prev.has(selectedProjectId)) return prev
      const next = new Set(prev)
      next.add(selectedProjectId)
      return next
    })
  }, [selectedProjectId])

  const toggleExpand = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const navigateTo = (href: string) => {
    // Always navigate — even when already on a sibling chat/project route
    router.push(href)
    // Close drawer on smaller screens after navigation; keep open on desktop
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose()
    }
  }

  const handleOpenProject = (projectId: string, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setExpandedIds((prev) => new Set(prev).add(projectId))
    navigateTo(`/project/${projectId}`)
  }

  const handleOpenChat = (
    projectId: string,
    chatId: string,
    e?: React.MouseEvent
  ) => {
    e?.preventDefault()
    e?.stopPropagation()
    setExpandedIds((prev) => new Set(prev).add(projectId))
    navigateTo(`/project/${projectId}/chat/${chatId}`)
  }

  const handleNewChat = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void (async () => {
      try {
        const chat = await createChat(projectId, "New Chat")
        setExpandedIds((prev) => new Set(prev).add(projectId))
        navigateTo(`/project/${projectId}/chat/${chat.id}`)
      } catch {
        toast({
          type: "error",
          title: "Couldn't start chat",
          description: "Please try again.",
        })
      }
    })()
  }

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-pointer bg-black/30 backdrop-blur-[1px] lg:hidden"
          aria-label="Close sidebar overlay"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full flex-col items-center border-r border-gray-200/80 bg-white py-3",
          SIDEBAR_RAIL_WIDTH,
          "transition-opacity duration-200",
          open ? "pointer-events-none opacity-0" : "opacity-100",
          "hidden lg:flex"
        )}
        aria-hidden={open}
        aria-label="Collapsed sidebar"
      >
        <RailButton label="Open sidebar" onClick={onOpen}>
          <PanelLeft className="size-5" />
        </RailButton>

        <div className="mt-2 flex flex-col items-center gap-1">
          <RailButton label="Create a new project" onClick={onCreateProject}>
            <SquarePen className="size-5" />
          </RailButton>
          <RailButton label="Search" onClick={() => comingSoon("Search")}>
            <Search className="size-5" />
          </RailButton>
          <RailButton label="Projects" onClick={onOpen}>
            <BookText className="size-5" />
          </RailButton>
        </div>

        <div className="mt-auto flex flex-col items-center gap-1">
          <RailButton label="Upgrade to Pro" onClick={() => comingSoon("Upgrade to Pro")}>
            <Sparkles className="size-5" />
          </RailButton>
          <RailButton label="Settings" onClick={() => comingSoon("Settings")}>
            <Settings className="size-5" />
          </RailButton>
          <button
            type="button"
            className="mt-2 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            aria-label="Account"
            onClick={onOpen}
          >
            <div
              className="flex size-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: "rgba(38,116,186,1)" }}
            >
              {initials(userName)}
            </div>
          </button>
        </div>
      </aside>

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-gray-200 bg-white shadow-sm",
          SIDEBAR_EXPANDED_WIDTH,
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!open}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200/80 px-3">
          <BrandName className="text-base" />
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer inline-flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="p-3">
            <button
              type="button"
              onClick={onCreateProject}
              className="cursor-pointer flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              <Plus className="size-4" />
              Create a new project
            </button>
          </div>

          <section className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Projects
            </h2>

            {projects.length === 0 ? (
              <EmptyState
                icon={<Folder className="size-8" />}
                title="No projects yet"
                description="Create your first project to get started"
                className="py-8"
              />
            ) : (
              <ul className="space-y-1">
                {projects.map((project) => {
                  const isSelected = project.id === selectedProjectId
                  const isExpanded = expandedIds.has(project.id)
                  const projectChats = getChatsForProject(project.id)

                  return (
                    <li key={project.id}>
                      <div
                        className={cn(
                          "group relative flex items-center rounded-lg transition-colors",
                          isSelected && !selectedChatId
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        )}
                      >
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(project.id, e)}
                          className="cursor-pointer flex size-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-gray-700"
                          aria-label={isExpanded ? "Collapse chats" : "Expand chats"}
                          aria-expanded={isExpanded}
                        >
                          <ChevronRight
                            className={cn(
                              "size-4 transition-transform duration-200",
                              isExpanded && "rotate-90"
                            )}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleOpenProject(project.id, e)}
                          className={cn(
                            "cursor-pointer flex min-w-0 flex-1 items-center gap-2 py-2 pr-1 text-left text-sm",
                            isSelected
                              ? "font-medium text-blue-600"
                              : "text-gray-800"
                          )}
                        >
                          <Folder
                            className={cn(
                              "size-4 shrink-0",
                              isSelected ? "text-blue-500" : "text-gray-400"
                            )}
                          />
                          <span className="truncate">{project.title}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleNewChat(project.id, e)}
                          className="cursor-pointer mr-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-all hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100 focus:opacity-100"
                          aria-label="New chat in project"
                          title="New chat"
                        >
                          <SquarePen className="size-3.5" />
                        </button>

                        <ProjectMenu
                          onRename={() => onRenameProject?.(project.id)}
                          onDelete={() => onDeleteProject?.(project.id)}
                        />
                      </div>

                      {isExpanded && (
                        <ul className="ml-4 mt-0.5 max-h-48 space-y-0.5 overflow-y-auto border-l border-gray-100 pl-2">
                          {projectChats.length === 0 ? (
                            <li className="px-2 py-1.5 text-xs text-gray-400">
                              No chats yet
                            </li>
                          ) : (
                            projectChats.map((chat) => {
                              const chatSelected = chat.id === selectedChatId
                              return (
                                <li key={chat.id}>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleOpenChat(project.id, chat.id, e)
                                    }
                                    className={cn(
                                      "cursor-pointer flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                      chatSelected
                                        ? "bg-blue-50 font-medium text-blue-600"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    )}
                                  >
                                    <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                                    <span className="truncate">{chat.title}</span>
                                  </button>
                                </li>
                              )
                            })
                          )}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="space-y-0.5 border-t border-gray-200 p-2">
            <SidebarAction
              icon={<Sparkles className="size-4 text-gray-500" />}
              label="Upgrade to Pro"
              onClick={() => comingSoon("Upgrade to Pro")}
            />
            <SidebarAction
              icon={<Megaphone className="size-4 text-gray-500" />}
              label="Updates & FAQ"
              onClick={() => comingSoon("Updates & FAQ")}
            />
            <SidebarAction
              icon={<Settings className="size-4 text-gray-500" />}
              label="Settings"
              onClick={() => comingSoon("Settings")}
            />
            <SidebarAction
              icon={<Power className="size-4" />}
              label="Log out"
              className="text-red-500 hover:bg-red-50"
              onClick={onLogout}
            />

            <div className="mt-2 flex items-center gap-3 rounded-lg bg-gray-50 p-2.5">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: "rgba(38,116,186,1)" }}
              >
                {initials(userName)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{userName}</p>
                <p className="truncate text-xs text-gray-500">
                  {userEmail ?? "Free account"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function ProjectMenu({
  onRename,
  onDelete,
}: {
  onRename: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cn(
          "cursor-pointer inline-flex size-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700",
          "opacity-0 group-hover:opacity-100 focus:opacity-100",
          open && "opacity-100 bg-gray-200 text-gray-700"
        )}
        aria-label="Project actions"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
            onClick={() => {
              setOpen(false)
              onRename()
            }}
          >
            <Pencil className="size-3.5 text-gray-500" />
            Rename
          </button>
          <button
            type="button"
            className="cursor-pointer flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function RailButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="cursor-pointer inline-flex size-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      {children}
    </button>
  )
}

function SidebarAction({
  icon,
  label,
  className,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-800 transition-colors hover:bg-gray-50",
        className
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}
