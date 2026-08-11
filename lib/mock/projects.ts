/**
 * Mock project store with localStorage persistence.
 * TODO(api): replace with project service API.
 */

import type { Project, ProjectStatus } from "@/types"

const STORAGE_KEY = "mindsurve_mock_projects"

function revive(project: Project): Project {
  return {
    ...project,
    createdAt: new Date(project.createdAt),
    updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,
  }
}

export function loadProjects(): Project[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Project[]
    return parsed.map(revive)
  } catch {
    return []
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export function createProject(title: string): Project {
  const project: Project = {
    id: `prj_${Date.now()}`,
    title: title.trim(),
    description: "",
    workflowType: "beginner",
    status: "CREATED",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const next = [project, ...loadProjects()]
  saveProjects(next)
  return project
}

export function updateProject(
  id: string,
  patch: Partial<Pick<Project, "title" | "description" | "idea" | "status">>
): Project | null {
  const projects = loadProjects()
  const index = projects.findIndex((p) => p.id === id)
  if (index === -1) return null

  const updated: Project = {
    ...projects[index],
    ...patch,
    title: patch.title?.trim() ?? projects[index].title,
    updatedAt: new Date(),
  }
  projects[index] = updated
  saveProjects(projects)
  return updated
}

export function deleteProject(id: string): boolean {
  const projects = loadProjects()
  const next = projects.filter((p) => p.id !== id)
  if (next.length === projects.length) return false
  saveProjects(next)
  return true
}

export function getProjectById(id: string): Project | undefined {
  return loadProjects().find((p) => p.id === id)
}

export function updateProjectStatus(id: string, status: ProjectStatus): Project | null {
  return updateProject(id, { status })
}
