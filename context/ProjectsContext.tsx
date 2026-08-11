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
  isLoading: boolean
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

  const createProject = useCallback(async (title: string) => {
    const dto = await projectsApi.create({ title })
    const project = mapProject(dto)
    flushSync(() => {
      setProjects((prev) => [project, ...prev.filter((p) => p.id !== project.id)])
    })
    return project
  }, [])

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
  }, [])

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects]
  )

  const value = useMemo(
    () => ({
      projects,
      isLoading: authLoading || isLoading,
      createProject,
      updateProjectTitle,
      deleteProject,
      getProject,
      refresh,
    }),
    [
      projects,
      authLoading,
      isLoading,
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
