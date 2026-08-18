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
import { flushSync } from "react-dom"
import { useAuth } from "@/context/AuthContext"
import { ApiError } from "@/lib/api/types"
import { mapProject, projectsApi } from "@/lib/api/projects"
import type { Project } from "@/types"

type ProjectsContextValue = {
  projects: Project[]
  /** Named projects only (hides personal inbox). */
  namedProjects: Project[]
  inboxProject: Project | undefined
  isLoading: boolean
  ensureInbox: () => Promise<Project>
  createProject: (title: string) => Promise<Project>
  updateProjectTitle: (id: string, title: string) => Promise<Project | null>
  deleteProject: (id: string) => Promise<boolean>
  getProject: (id: string) => Project | undefined
  refresh: () => Promise<void>
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setProjects([])
      return
    }
    const rows = await projectsApi.list()
    setProjects(rows.map(mapProject))
  }, [isAuthenticated])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setProjects([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    void refresh()
      .catch(() => {
        if (!cancelled) setProjects([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, refresh])

  const upsertProject = useCallback((project: Project) => {
    flushSync(() => {
      setProjects((prev) => [
        project,
        ...prev.filter((p) => p.id !== project.id),
      ])
    })
  }, [])

  const ensureInbox = useCallback(async () => {
    const existing = projects.find((p) => p.isInbox)
    if (existing) return existing
    const dto = await projectsApi.inbox()
    const project = mapProject(dto)
    upsertProject(project)
    return project
  }, [projects, upsertProject])

  const createProject = useCallback(
    async (title: string) => {
      const dto = await projectsApi.create({ title })
      const project = mapProject(dto)
      upsertProject(project)
      return project
    },
    [upsertProject]
  )

  const updateProjectTitle = useCallback(async (id: string, title: string) => {
    try {
      const dto = await projectsApi.rename(id, title)
      const updated = mapProject(dto)
      flushSync(() => {
        setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)))
      })
      return updated
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null
      throw err
    }
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    const target = projects.find((p) => p.id === id)
    if (target?.isInbox) {
      throw new ApiError(
        "Personal chats can’t be deleted as a project.",
        422
      )
    }
    try {
      await projectsApi.delete(id)
      flushSync(() => {
        setProjects((prev) => prev.filter((p) => p.id !== id))
      })
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return false
      throw err
    }
  }, [projects])

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects]
  )

  const namedProjects = useMemo(
    () => projects.filter((p) => !p.isInbox),
    [projects]
  )
  const inboxProject = useMemo(
    () => projects.find((p) => p.isInbox),
    [projects]
  )

  const value = useMemo(
    () => ({
      projects,
      namedProjects,
      inboxProject,
      isLoading: authLoading || isLoading,
      ensureInbox,
      createProject,
      updateProjectTitle,
      deleteProject,
      getProject,
      refresh,
    }),
    [
      projects,
      namedProjects,
      inboxProject,
      authLoading,
      isLoading,
      ensureInbox,
      createProject,
      updateProjectTitle,
      deleteProject,
      getProject,
      refresh,
    ]
  )

  return (
    <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
  )
}

export function useProjects() {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider")
  return ctx
}
