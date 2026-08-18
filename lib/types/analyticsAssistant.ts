/* eslint-disable @typescript-eslint/no-explicit-any */

export type AssistantStatus = "answered" | "needs_clarification" | "unsupported" | "error"
export type AssistantMetricCode = "T" | "B" | "R"
export type AssistantDirection = "highest" | "lowest"

export type AssistantToolName =
  | "greeting"
  | "study_overview"
  | "classification_distribution"
  | "rank_elements"
  | "rank_designs"
  | "explain_design"
  | "compare"
  | "compare_segments"
  | "executive_summary"
  | "use_avoid_elements"
  | "response_time_summary"
  | "fatigue_summary"
  | "explain_mindset"
  | "list_saved_designs"
  | "generate_ppt"
  | "clarify"
  | "unsupported"

export type AssistantCompareMode = "segment" | "design" | "classification"

export interface AssistantFollowUpContext {
  metric?: AssistantMetricCode | null
  segment_section?: string | null
  segment_key?: string | null
  gender_key?: string | null
  age_key?: string | null
  classification_question?: string | null
  classification_options?: string[] | null
  last_tool?: AssistantToolName | null
  last_direction?: AssistantDirection | null
  last_limit?: number | null
}

export interface AssistantQueryRequest {
  message: string
  filters?: Record<string, any> | null
  use_active_filters?: boolean
  metric?: AssistantMetricCode | null
  segment_section?: string | null
  segment_key?: string | null
  follow_up?: AssistantFollowUpContext | null
  conversation_id?: string | null
  /** Stable client UUID for optimistic UI + idempotent retries. */
  client_message_id?: string | null
}

export interface EvidenceFact {
  fact_id: string
  label: string
  value?: string | number | null
  unit?: string | null
  meta?: Record<string, any>
}

export interface AppliedContext {
  study_id: string
  study_type: string
  study_title?: string | null
  metric?: string | null
  segment_label?: string | null
  filters?: Record<string, any> | null
  base_size?: number | null
  panelists?: number | null
  analysis_settings_echo?: Record<string, any> | null
  verified?: boolean
  algorithm_version?: string
}

export interface AssistantBlock {
  type: string
  title?: string | null
  data?: Record<string, any>
}

export interface AssistantAction {
  type:
    | "apply_filter"
    | "open_view"
    | "open_configurator"
    | "save_design"
    | "compare_designs"
    | "export_csv"
    | "download_ppt"
    | "set_metric"
    | "set_segment"
  label: string
  payload?: Record<string, any>
}

export interface AssistantQueryResponse {
  request_id: string
  status: AssistantStatus
  answer_text: string
  tool?: AssistantToolName | null
  applied_context: AppliedContext
  blocks: AssistantBlock[]
  evidence: EvidenceFact[]
  follow_ups: string[]
  actions: AssistantAction[]
  clarification_options: string[]
  follow_up_context?: AssistantFollowUpContext | null
  usage?: Record<string, any>
  error?: string | null
  user_message_id?: string | null
  assistant_message_id?: string | null
  conversation_id?: string | null
}

export interface AssistantChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  createdAt: string
  response?: AssistantQueryResponse
  pending?: boolean
  error?: string | null
  /** Stable client UUID used for send/retry reconciliation. */
  clientMessageId?: string | null
  /** Server-assigned UUID once persisted. */
  serverId?: string | null
  parentMessageId?: string | null
  status?: "sending" | "sent" | "complete" | "error" | "failed"
  /** Local-only synthetic welcome bubble (not persisted). */
  localOnly?: boolean
}

export interface AssistantHistoryItem {
  id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  client_message_id?: string | null
  parent_message_id?: string | null
  status?: string
  response?: AssistantQueryResponse | null
}

export interface AssistantHistoryMeta {
  limit: number
  has_more: boolean
  next_cursor?: string | null
  conversation_id?: string | null
}

export interface AssistantHistoryPage {
  items: AssistantHistoryItem[]
  meta: AssistantHistoryMeta
  follow_up_context?: AssistantFollowUpContext | null
}

export interface AssistantClearHistoryResponse {
  deleted: number
  conversation_id?: string | null
}

export interface DesignElementSnapshot {
  element_id: string
  category_key: string
  category_name: string
  name: string
  value: number
  code?: string | null
  image_url?: string | null
  element_type?: string | null
  z_index?: number
  layer_id?: string | null
  image_id?: string | null
  transform?: { x?: number; y?: number; width?: number; height?: number } | null
}

export interface DesignRankItem {
  rank: number
  score: number
  selection_count: number
  selected_by_category: Record<string, string>
  elements: DesignElementSnapshot[]
  fact_id: string
  constraints_applied?: boolean
  complete_layers?: boolean
}
