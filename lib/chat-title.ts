/**
 * Chat title generation from the first user message.
 * TODO(api): call LLM for title; keep this as deterministic fallback.
 * Must never block message creation or the main assistant reply.
 */

const STOP_WORDS = new Set([
  "i",
  "we",
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "and",
  "or",
  "my",
  "our",
  "want",
  "need",
  "like",
  "about",
  "with",
  "this",
  "that",
  "which",
  "what",
  "how",
  "can",
  "you",
  "me",
  "us",
  "in",
  "on",
  "is",
  "are",
  "be",
  "do",
  "does",
  "please",
  "help",
  "create",
  "make",
  "get",
  "know",
  "understand",
  "people",
  "prefer",
  "customers",
])

/** Sync deterministic title — always available if LLM fails. */
export function fallbackChatTitle(firstMessage: string): string {
  const cleaned = firstMessage
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!cleaned) return "New Chat"

  const words = cleaned.split(" ").filter(Boolean)
  const meaningful = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()))
  const picked = (meaningful.length >= 2 ? meaningful : words).slice(0, 6)

  const title = picked
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")

  return title.slice(0, 48) || "New Chat"
}

/**
 * Mock async title generation (simulates LLM).
 * Resolves with a short title; falls back on error.
 */
export async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    // TODO(api): POST /ai/chat-title { message }
    await new Promise((r) => setTimeout(r, 400))
    return fallbackChatTitle(firstMessage)
  } catch {
    return fallbackChatTitle(firstMessage)
  }
}
