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
  is_inbox?: boolean
  is_owner?: boolean
  created_at: string
  updated_at: string
}

export type CollaboratorDto = {
  id: string
  email: string
  name?: string | null
  is_owner: boolean
  status: "active" | "pending"
}

export type CollaboratorInviteResult = {
  id: string
  email: string
  status: "active" | "pending"
  message: string
  project_id?: string | null
  chat_id?: string | null
  promoted_from_inbox?: boolean
}

export function mapProject(dto: ProjectDto): Project {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description ?? "",
    idea: dto.idea ?? undefined,
    workflowType: dto.workflow_type,
    status: dto.status,
    isInbox: Boolean(dto.is_inbox || dto.workflow_type === "inbox"),
    isOwner: dto.is_owner !== false,
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
  inbox() {
    return api.get<ProjectDto>("/projects/inbox")
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
  listCollaborators(projectId: string) {
    return api.get<CollaboratorDto[]>(`/projects/${projectId}/collaborators`)
  },
  inviteCollaborator(projectId: string, email: string) {
    return api.post<CollaboratorInviteResult>(
      `/projects/${projectId}/collaborators`,
      { email }
    )
  },
  inviteChatCollaborator(chatId: string, email: string) {
    return api.post<CollaboratorInviteResult>(
      `/chats/${chatId}/collaborators`,
      { email }
    )
  },
  removeCollaborator(projectId: string, memberId: string) {
    return api.delete<{ message: string }>(
      `/projects/${projectId}/collaborators/${memberId}`
    )
  },
}

