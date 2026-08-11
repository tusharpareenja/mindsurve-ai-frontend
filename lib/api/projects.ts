"use client"

import { api } from "@/lib/api/client"
import type { Project, ProjectStatus, WorkflowType } from "@/types"

export type ProjectDto = {
  id: string
  title: string
  description: string
  idea?: string | null
  workflow_type: WorkflowType
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export function mapProject(dto: ProjectDto): Project {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description ?? "",
    idea: dto.idea ?? undefined,
    workflowType: dto.workflow_type,
    status: dto.status,
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  }
}

export const projectsApi = {
  list() {
    return api.get<ProjectDto[]>("/projects")
  },
  get(id: string) {
    return api.get<ProjectDto>(`/projects/${id}`)
  },
  create(input: { title: string }) {
    return api.post<ProjectDto>("/projects", input)
  },
  rename(id: string, title: string) {
    return api.patch<ProjectDto>(`/projects/${id}`, { title })
  },
  delete(id: string) {
    return api.delete<{ message: string }>(`/projects/${id}`)
  },
}
