"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Plus, Menu, BookText, Power } from "lucide-react"

type Project = {
  id: string
  title: string
  description: string
  createdAt: Date
}

type SidebarProps = {
  open: boolean
  onClose: () => void
  projects: Project[]
  selectedProjectId?: string
  onCreateProject?: () => void
}

export default function Sidebar({ open, onClose, projects = [], selectedProjectId, onCreateProject }: SidebarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Collapse toggle only on large screens
  const handleToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsCollapsed((v) => !v)
    } else {
      onClose()
    }
  }

  // If screen resizes from mobile to desktop, ensure sidebar is visible state-wise
  useEffect(() => {
    const onResize = () => {
      const isDesktop = window.innerWidth >= 1024
      setIsCollapsed(isDesktop ? false : false)
    }
    // Initialize on mount
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return (
    <>
      {/* Panel */}
      <aside
        ref={containerRef}
        className={`fixed left-0 top-0 bottom-0 bg-white border-r border-blue-200 shadow-2xl z-50
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        w-80 sm:w-72 ${isCollapsed ? "lg:w-16" : "lg:w-80"}
        transition-[transform,width] duration-300 ease-out`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className={`h-14 px-3 sm:px-4 border-b border-blue-200 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2 text-black font-semibold text-sm sm:text-base">
              <div className="size-5 sm:size-6 rounded-full bg-blue-500 grid place-items-center">
                <Plus className="size-3 sm:size-4 text-white" />
              </div>
              LOGO
            </div>
          )}
          <button
            onClick={handleToggle}
            className="p-1.5 sm:p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close sidebar"
          >
            <Menu className="size-4 sm:size-5" />
          </button>
        </div>

        {/* Body: Projects (scrollable) + Bottom actions pinned */}
        <div className="flex h-[calc(100vh-3.5rem)] flex-col">
          {/* Projects Section (scrollable) */}
          <section className={`flex-1 overflow-y-auto ${isCollapsed ? "p-2" : "p-2 sm:p-3"}`}>
            {!isCollapsed && <h2 className="text-sm font-semibold text-black mb-3 sm:mb-4">Projects</h2>}

            {projects.length === 0 ? (
              <div className="text-center py-8">
                <BookText className="size-8 text-gray-400 mx-auto mb-2" />
                {!isCollapsed && (
                  <>
                    <p className="text-sm text-gray-500">No projects yet</p>
                    <p className="text-xs text-gray-400 mt-1">Create your first project to get started</p>
                  </>
                )}
              </div>
            ) : (
              <ul className="space-y-1 sm:space-y-2">
                {projects.map((project) => {
                  const isSelected = project.id === selectedProjectId
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/project/${project.id}`}
                        className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2 sm:gap-3 px-2 sm:px-3"} py-2 rounded-md text-sm sm:text-base group transition-colors ${
                          isSelected
                            ? "bg-blue-100 text-blue-600 border-l-2 border-blue-500"
                            : "hover:bg-gray-50 text-black"
                        }`}
                      >
                        <BookText
                          className={`size-5 flex-shrink-0 transition-colors ${
                            isSelected ? "text-blue-500" : "text-gray-400 group-hover:text-blue-500"
                          }`}
                        />
                        {!isCollapsed && <span className="truncate">{project.title}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Bottom Actions pinned to bottom */}
          <section className={`p-2 sm:p-3 ${isCollapsed ? "space-y-3" : "space-y-1 sm:space-y-2"}`}>
            {/* Create project */}
            {isCollapsed ? (
              <button
                onClick={onCreateProject}
                className="w-full inline-flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors h-10"
                aria-label="Create project"
              >
                <Plus className="size-5" />
              </button>
            ) : (
              <button
                onClick={onCreateProject}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm sm:text-base"
              >
                <Plus className="size-4" />
                <span className="truncate">Create a new project</span>
              </button>
            )}

            {/* Other actions */}
            <button className={`w-full inline-flex items-center ${isCollapsed ? "justify-center h-10" : "gap-2 px-2 sm:px-3 py-2"} rounded-md hover:bg-gray-50 text-red-500 transition-colors text-sm sm:text-base`}>
              <Power className="size-5" />
              {!isCollapsed && <span className="truncate">Log out</span>}
            </button>

            {!isCollapsed && (
              <div className="mt-2 sm:mt-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-100">
                  <img src="/placeholder-user.jpg" alt="Account avatar" className="h-8 w-8 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black truncate">Your Name</p>
                    <p className="text-xs text-gray-500 truncate">Free account</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>

      {/* Dialog handled by parent via onCreateProject callback */}
    </>
  )
}
